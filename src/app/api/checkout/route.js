import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { Order } from "@/models/Order";
import { mpPreference } from "@/lib/mp";
import { recordEvent } from "@/lib/analyticsStore";
import { getOrCreateSid } from "@/lib/analytics";
import { quoteCorreoOrder } from "@/lib/correoArgentino";
import { getLearnedRate } from "@/lib/shipping/getLearnedRate";
import { getPackageKeyFromDimensions } from "@/lib/shipping/fallbackLearning";

// ---------- Zod ----------
const ShippingAddressSchema = z
  .object({
    province: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    streetName: z.string().optional(),
    streetNumber: z.string().optional(),
    apt: z.string().nullable().optional(),
    dni: z.string().optional(),
    notes: z.string().nullable().optional(),
  })
  .optional();

const BuyerSchema = z.object({
  name: z.string().min(2).max(80).optional().default(""),
  phone: z.string().min(6).max(30).optional().default(""),
  email: z.string().email(),
  shippingAddress: ShippingAddressSchema,

  // compat TEMPORARIA si tu front todavía manda buyer.shipping
  shipping: z.any().optional(),
});

const QuoteSchema = z
  .object({
    carrier: z.string().optional().default(""),
    service: z.string().optional().default(""),
    price: z.coerce.number().optional(),
    eta: z.string().optional().default(""),
    mode: z.string().optional(),
  })
  .optional()
  .default({});

const MetaSchema = z
  .object({
    eventId: z.string().optional().default(""),
    fbp: z.string().optional().default(""),
    fbc: z.string().optional().default(""),
  })
  .optional()
  .default({});

const CheckoutSchema = z.object({
  items: z
    .array(z.object({ slug: z.string(), qty: z.number().int().min(1).max(20) }))
    .min(1),
  buyer: BuyerSchema,
  zip: z.string().optional(),
  shipping: QuoteSchema,
  meta: MetaSchema,
});

const FREE_SHIPPING_THRESHOLD = 45000;
const FREE_SHIPPING_PRODUCT_SLUGS = ["pack-completo"];

// ---------- helpers ----------
function h(req, key) {
  return String(req.headers.get(key) || "").trim();
}

function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

function normZip(v) {
  return onlyDigits(v).slice(0, 4);
}

function makePublicCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function makeAccessKey() {
  return crypto.randomBytes(16).toString("hex");
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function hasAnyAddress(a) {
  if (!a || typeof a !== "object") return false;
  return Boolean(
    a.postalCode ||
      a.city ||
      a.province ||
      a.streetName ||
      a.streetNumber ||
      a.street
  );
}

function normAddr(a) {
  const raw = a || {};
  return {
    province: String(raw.province || "").trim(),
    city: String(raw.city || "").trim(),
    postalCode: String(raw.postalCode || "").trim(),
    streetName: String(raw.streetName || raw.street || "").trim(),
    streetNumber: String(raw.streetNumber || "").trim(),
    apt: raw.apt == null ? "" : String(raw.apt).trim(),
    dni: String(raw.dni || "").trim(),
    notes: raw.notes == null ? "" : String(raw.notes).trim(),
  };
}

function mustUseFallbackShipping(err) {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("missing env") ||
    msg.includes("missing") ||
    msg.includes("credencial") ||
    msg.includes("credentials") ||
    msg.includes("no disponible") ||
    msg.includes("not configured") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("timeout") ||
    msg.includes("econn") ||
    msg.includes("network") ||
    msg.includes("sin tarifas") ||
    msg.includes("aborted") ||
    msg.includes("fetch failed")
  );
}

function getFallbackShippingQuote({ zip, originZip, provinceCode }) {
  const destinationZip = normZip(zip);
  const origin = normZip(originZip);
  const p = String(provinceCode || "").toUpperCase();
  const prefix = destinationZip.charAt(0);

  if (origin && destinationZip && origin === destinationZip) {
    return {
      provider: "local",
      service: "Envío gratis zona local",
      eta: "Coordinar entrega",
      price: 0,
      deliveredType: "D",
      validTo: null,
    };
  }

  // AMBA / cercanos
  if (["1", "2", "3"].includes(prefix)) {
    return {
      provider: "zones",
      service: "Tarifa fija AMBA / cercanos",
      eta: "2 a 5 días hábiles",
      price: 6900,
      deliveredType: "D",
      validTo: null,
    };
  }

  // Interior / centro / sur bonaerense
  if (["4", "5", "6", "7", "8"].includes(prefix)) {
    return {
      provider: "zones",
      service: "Tarifa fija interior",
      eta: "2 a 6 días hábiles",
      price: 7900,
      deliveredType: "D",
      validTo: null,
    };
  }

  // Patagonia más lejana
  if (["9"].includes(prefix) || ["R", "Q", "U", "Z", "V"].includes(p)) {
    return {
      provider: "zones",
      service: "Tarifa fija zona lejana",
      eta: "4 a 10 días hábiles",
      price: 11900,
      deliveredType: "D",
      validTo: null,
    };
  }

  return {
    provider: "zones",
    service: "Tarifa fija resto del país",
    eta: "3 a 9 días hábiles",
    price: 8900,
    deliveredType: "D",
    validTo: null,
  };
}

function pickPackaging(items) {
  const normalizedItems = Array.isArray(items) ? items : [];

  const qtyBySlug = normalizedItems.reduce((acc, item) => {
    const slug = String(item.slug || "").trim();
    const qty = Number(item.qty || 0);
    if (!slug || qty <= 0) return acc;
    acc[slug] = (acc[slug] || 0) + qty;
    return acc;
  }, {});

  const esencialQty = qtyBySlug["pack-esencial"] || 0;
  const familiarQty = qtyBySlug["pack-familiar"] || 0;
  const completoQty = qtyBySlug["pack-completo"] || 0;
  const cubierteroQty = qtyBySlug["cubiertero-bambu"] || 0;

  const totalMainPacks = esencialQty + familiarQty + completoQty;

  if (totalMainPacks === 0 && cubierteroQty === 0) {
    return {
      weight: 500,
      height: 12,
      width: 20,
      length: 30,
    };
  }

  if (
    esencialQty === 1 &&
    familiarQty === 0 &&
    completoQty === 0 &&
    cubierteroQty === 0
  ) {
    return {
      weight: 435 + 180,
      height: 15,
      width: 20,
      length: 20,
    };
  }

  if (
    esencialQty === 1 &&
    familiarQty === 0 &&
    completoQty === 0 &&
    cubierteroQty === 1
  ) {
    return {
      weight: 1335 + 300,
      height: 25,
      width: 35,
      length: 45,
    };
  }

  if (
    esencialQty === 0 &&
    familiarQty === 1 &&
    completoQty === 0 &&
    cubierteroQty === 0
  ) {
    return {
      weight: 955 + 260,
      height: 25,
      width: 20,
      length: 25,
    };
  }

  if (
    esencialQty === 0 &&
    familiarQty === 1 &&
    completoQty === 0 &&
    cubierteroQty === 1
  ) {
    return {
      weight: 1855 + 380,
      height: 35,
      width: 35,
      length: 45,
    };
  }

  if (
    esencialQty === 0 &&
    familiarQty === 0 &&
    completoQty === 1 &&
    cubierteroQty === 0
  ) {
    return {
      weight: 2410 + 420,
      height: 25,
      width: 35,
      length: 40,
    };
  }

  if (
    esencialQty === 0 &&
    familiarQty === 0 &&
    completoQty === 1 &&
    cubierteroQty === 1
  ) {
    return {
      weight: 3310 + 500,
      height: 35,
      width: 35,
      length: 45,
    };
  }

  if (totalMainPacks === 0 && cubierteroQty >= 1) {
    return {
      weight: 900 + 220 * cubierteroQty,
      height: 10,
      width: 35,
      length: 45,
    };
  }

  const productsWeight =
    esencialQty * 435 +
    familiarQty * 955 +
    completoQty * 2410 +
    cubierteroQty * 900;

  const estimatedBoxesWeight =
    esencialQty * 180 +
    familiarQty * 260 +
    completoQty * 420 +
    cubierteroQty * 220;

  const totalWeight = productsWeight + estimatedBoxesWeight;

  let length = 20;
  let width = 20;
  let height = 15;

  if (completoQty > 0) {
    length = 40;
    width = 35;
    height = 25;
  } else if (familiarQty > 0) {
    length = 25;
    width = 20;
    height = 25;
  } else if (esencialQty > 0) {
    length = 20;
    width = 20;
    height = 15;
  }

  if (cubierteroQty > 0 && totalMainPacks > 0) {
    length = 45;
    width = 35;
    height = 35;
  }

  if (totalMainPacks >= 2) {
    height += 10;
  }

  if (totalMainPacks >= 3) {
    height += 10;
    length = Math.max(length, 45);
    width = Math.max(width, 35);
  }

  return {
    weight: Math.round(totalWeight),
    height: Math.round(height),
    width: Math.round(width),
    length: Math.round(length),
  };
}

// ---------- route ----------
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const parsed = CheckoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items, buyer, shipping: shippingFromClient, meta = {} } = parsed.data;

  const rawAddr = hasAnyAddress(buyer?.shippingAddress)
    ? buyer.shippingAddress
    : buyer?.shipping;

  const shippingAddress = normAddr(rawAddr);

  const buyerNormalized = {
    email: String(buyer?.email || "").trim().toLowerCase(),
    name: buyer?.name ? String(buyer.name).trim() : "",
    phone: buyer?.phone ? String(buyer.phone).trim() : "",
    shippingAddress,
  };

  const zip = normZip(parsed.data.zip) || normZip(shippingAddress?.postalCode) || "";

  if (!zip || zip.length !== 4) {
    return NextResponse.json(
      { error: "Código postal inválido. Cotizá el envío antes de pagar." },
      { status: 400 }
    );
  }

  await connectDB();

  const slugs = items.map((i) => i.slug);
  const products = await Product.find({
    slug: { $in: slugs },
    isActive: true,
  }).lean();

  if (products.length !== slugs.length) {
    return NextResponse.json(
      { error: "Producto no encontrado o inactivo." },
      { status: 404 }
    );
  }

  const orderItems = items.map((i) => {
    const p = products.find((pp) => pp.slug === i.slug);
    return {
      productId: p._id,
      title: p.title,
      slug: p.slug,
      qty: i.qty,
      unitPrice: p.price,
    };
  });

  const itemsTotal = orderItems.reduce(
    (acc, it) => acc + it.qty * it.unitPrice,
    0
  );

  const hasFreeShippingProduct = orderItems.some((it) =>
    FREE_SHIPPING_PRODUCT_SLUGS.includes(it.slug)
  );

  const qualifiesByAmount = itemsTotal >= FREE_SHIPPING_THRESHOLD;

  let shipQuote = null;

  const originZip = normZip(
    process.env.CA_POSTAL_CODE_ORIGIN ||
      process.env.NEXT_PUBLIC_CA_POSTAL_ORIGIN ||
      ""
  );

  const provRaw = String(shippingAddress?.province || "").trim().toUpperCase();
  const provCode =
    provRaw.length === 1
      ? provRaw
      : provRaw.includes("BUENOS")
      ? "B"
      : provRaw;

  const isLocalFreeShipping =
    provCode === "B" && !!originZip && zip === originZip;

  const shouldApplyFreeShipping =
    isLocalFreeShipping || qualifiesByAmount || hasFreeShippingProduct;

  if (shouldApplyFreeShipping) {
    let provider = "promo";
    let service = "Envío gratis";

    if (isLocalFreeShipping) {
      provider = "local";
      service = "Envío gratis zona local";
    } else if (hasFreeShippingProduct) {
      provider = "promo";
      service = "Envío gratis incluido en este pack";
    } else if (qualifiesByAmount) {
      provider = "promo";
      service = `Envío gratis desde ${FREE_SHIPPING_THRESHOLD}`;
    }

    shipQuote = {
      provider,
      service,
      eta: isLocalFreeShipping ? "Coordinar entrega" : "",
      price: 0,
      deliveredType: "D",
      validTo: null,
    };
  } else {
    let correoQuote = null;

    const dimensions = pickPackaging(
      orderItems.map((it) => ({ slug: it.slug, qty: it.qty }))
    );
    const packageKey = getPackageKeyFromDimensions(dimensions);

    try {
      correoQuote = await quoteCorreoOrder({
        postalCodeDestination: zip,
        items: orderItems.map((it) => ({ slug: it.slug, qty: it.qty })),
        deliveredType: "D",
      });
    } catch (e) {
      if (!mustUseFallbackShipping(e)) {
        return NextResponse.json(
          { error: e?.message || "No se pudo cotizar el envío." },
          { status: 400 }
        );
      }

      console.warn("[checkout] Correo no disponible, uso learned/fallback:", e?.message || e);
    }

    if (correoQuote) {
      shipQuote = correoQuote;
    } else {
      let learnedRate = null;

      try {
        learnedRate = await getLearnedRate({
          deliveredType: "D",
          provinceCode: provCode,
          packageKey,
        });
      } catch (err) {
        console.error("[checkout] error en getLearnedRate", {
          message: err?.message,
          stack: err?.stack,
        });
      }

      if (learnedRate) {
        console.log("[checkout] usando tarifa aprendida", {
          provinceCode: provCode,
          packageKey,
          zip,
        });
        shipQuote = {
          provider: "learned",
          service: learnedRate.service || "Tarifa estimada",
          eta: learnedRate.eta || "",
          price: safeNum(learnedRate.price),
          deliveredType: learnedRate.deliveredType || "D",
          validTo: null,
        };
      } else {
        console.warn("[checkout] fallback puro", {
          zip,
          provinceCode: provCode,
          packageKey,
        });

        shipQuote = getFallbackShippingQuote({
          zip,
          originZip,
          provinceCode: provCode,
        });
      }
    }
  }

  const shippingTotal = safeNum(shipQuote?.price || 0);
  const clientShippingPrice = safeNum(shippingFromClient?.price);

  if (
    clientShippingPrice > 0 &&
    shippingTotal > 0 &&
    clientShippingPrice !== shippingTotal
  ) {
    console.warn("[checkout] shipping mismatch", {
      clientShippingPrice,
      serverShippingPrice: shippingTotal,
      zip,
      provinceCode: provCode,
      clientShipping: shippingFromClient,
      serverShipQuote: shipQuote,
    });
  }

  if (!shouldApplyFreeShipping && shippingTotal <= 0) {
    return NextResponse.json(
      { error: "Cotizá el envío antes de pagar." },
      { status: 400 }
    );
  }

  const total = itemsTotal + shippingTotal;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const externalReference = `order_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;

  const utm = {
    source: h(req, "x-utm-source"),
    medium: h(req, "x-utm-medium"),
    campaign: h(req, "x-utm-campaign"),
    term: h(req, "x-utm-term"),
    content: h(req, "x-utm-content"),
  };
  const path = h(req, "x-path");
  const ref = h(req, "x-ref");

  const res = NextResponse.json({ ok: true });
  const sid = getOrCreateSid(req, res);

  const mpItems = [
    ...orderItems.map((it) => ({
      id: it.slug,
      title: it.title,
      quantity: it.qty,
      unit_price: it.unitPrice,
      currency_id: "ARS",
    })),
    {
      id: "shipping",
      title: `Envío (${shipQuote?.provider || "Correo"} ${shipQuote?.service || ""})`,
      quantity: 1,
      unit_price: shippingTotal,
      currency_id: "ARS",
    },
  ];

  const preference = await mpPreference().create({
    body: {
      items: mpItems,
      back_urls: {
        success: `${siteUrl}/success`,
        pending: `${siteUrl}/pending`,
        failure: `${siteUrl}/failure`,
      },
      auto_return: "approved",
      notification_url: `${siteUrl}/api/webhooks/mercadopago`,
      external_reference: externalReference,
    },
  });

  let publicCode = makePublicCode();
  for (let i = 0; i < 5; i++) {
    const exists = await Order.findOne({ publicCode }).lean();
    if (!exists) break;
    publicCode = makePublicCode();
  }
  const accessKey = makeAccessKey();

  await Order.create({
    publicCode,
    accessKey,
    buyer: buyerNormalized,
    items: orderItems,

    itemsTotal,
    shippingTotal,
    total,
    currency: "ARS",

    status: "pending",
    mp: {
      preferenceId: preference.id,
      lastPreferenceCreatedAt: new Date(),
    },
    externalReference,

    shippingData: {
      provider: shipQuote?.provider || "correo-argentino",
      deliveredType: shipQuote?.deliveredType || "D",
      postalCodeOrigin: originZip || process.env.NEXT_PUBLIC_CA_POSTAL_ORIGIN || "",
      postalCodeDestination: zip,
      quote: {
        carrier: String(shipQuote?.provider || shippingFromClient?.carrier || ""),
        service: String(shipQuote?.service || shippingFromClient?.service || ""),
        price: shippingTotal,
        eta: String(shipQuote?.eta || shippingFromClient?.eta || ""),
        validTo: shipQuote?.validTo || null,
      },
    },

    shippingStatus: "pending",
    trackingCode: "",
    adminNotes: "",

    meta: {
      eventId: String(meta?.eventId || ""),
      fbp: String(meta?.fbp || ""),
      fbc: String(meta?.fbc || ""),
      capiPurchaseSentAt: null,
    },

    utm,
    landingPath: path,
    referrer: ref,
  });

  try {
    await recordEvent({
      type: "begin_checkout",
      sid,
      path,
      ref,
      utm,
      order: { publicCode, total, currency: "ARS", status: "pending" },
      meta: {
        externalReference,
        distinct: items.length,
        itemsCount: items.reduce((a, x) => a + Number(x.qty || 0), 0),
        itemsTotal,
        shippingTotal,
        freeShipping: shouldApplyFreeShipping,
        freeShippingLocal: isLocalFreeShipping,
        freeShippingByAmount: qualifiesByAmount,
        freeShippingByProduct: hasFreeShippingProduct,
        originZip,
        destinationZip: zip,
      },
    });

    await recordEvent({
      type: "redirect_to_mp",
      sid,
      path,
      ref,
      utm,
      order: { publicCode, total, currency: "ARS", status: "pending" },
      meta: { mpPreferenceId: preference.id, externalReference },
    });
  } catch (e) {
    console.warn("[analytics] checkout track failed:", e?.message || e);
  }

  const finalRes = NextResponse.json({
    ok: true,
    init_point: preference.init_point,
    externalReference,
    publicCode,
    accessKey,
  });

  try {
    const sidCookie = res.cookies.get("sid");
    if (sidCookie?.value) {
      finalRes.cookies.set("sid", sidCookie.value, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
  } catch {}

  return finalRes;
}