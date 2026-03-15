import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { Order } from "@/models/Order";
import { mpPreference } from "@/lib/mp";
import { recordEvent } from "@/lib/analyticsStore";
import { getOrCreateSid } from "@/lib/analytics";
import { quoteCorreo } from "@/lib/shipping/correo";

// ---------- Zod (limpio y alineado al model nuevo) ----------
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

  // compat TEMPORARIA si tu front todavía manda buyer.shipping (borrar cuando migres)
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
  shipping: QuoteSchema, // quote del front (solo hint)
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
    a.postalCode || a.city || a.province || a.streetName || a.streetNumber || a.street
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
    msg.includes("network")
  );
}

// ---------- route ----------
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const parsed = CheckoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items, buyer, shipping: shippingFromClient, meta = {} } = parsed.data;

  // ✅ buyerNormalized alineado al model: buyer.shippingAddress
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

  /* const existingPending = await Order.findOne({
    "buyer.email": buyerNormalized.email,
    status: "pending",
  }).sort({ createdAt: -1 });

  if (existingPending) {
    return NextResponse.json({
      ok: true,
      init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${existingPending.mp.preferenceId}`,
      externalReference: existingPending.externalReference,
      publicCode: existingPending.publicCode,
      accessKey: existingPending.accessKey,
    });
  } */

  // productos
  const slugs = items.map((i) => i.slug);
  const products = await Product.find({ slug: { $in: slugs }, isActive: true }).lean();

  if (products.length !== slugs.length) {
    return NextResponse.json({ error: "Producto no encontrado o inactivo." }, { status: 404 });
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

  const itemsTotal = orderItems.reduce((acc, it) => acc + it.qty * it.unitPrice, 0);

  const hasFreeShippingProduct = orderItems.some((it) =>
    FREE_SHIPPING_PRODUCT_SLUGS.includes(it.slug)
  );

  const qualifiesByAmount = itemsTotal >= FREE_SHIPPING_THRESHOLD;

  // ✅ Re-cotizamos server-side
  let shipQuote = null;

  // ✅ Envío gratis si el CP destino es el mismo que el origen (vendedor)
  const originZip = normZip(process.env.NEXT_PUBLIC_CA_POSTAL_ORIGIN || "");

  // province puede venir como "B" o como "Buenos Aires" (según tu UI).
  // Tu UI hoy manda code, pero lo normalizo por las dudas.
  const provRaw = String(shippingAddress?.province || "").trim().toUpperCase();
  const provCode = provRaw.length === 1 ? provRaw : (
    provRaw.includes("BUENOS") ? "B" : provRaw
  );

  const isLocalFreeShipping = provCode === "B" && !!originZip && zip === originZip;

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
    try {
      shipQuote = await quoteCorreo({
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

      const clientPrice = safeNum(shippingFromClient?.price);
      const clientMode = String(shippingFromClient?.mode || "").toLowerCase();

      // ✅ si el front dice "free", lo aceptamos SOLO si cumple BA + mismo CP origen
      if (clientMode === "free" && shouldApplyFreeShipping) {
        let provider = "promo";
        let service = shippingFromClient?.service || "Envío gratis";

        if (isLocalFreeShipping) {
          provider = "local";
        }

        shipQuote = {
          provider,
          service,
          eta: shippingFromClient?.eta || (isLocalFreeShipping ? "Coordinar entrega" : ""),
          price: 0,
          deliveredType: "D",
          validTo: null,
        };
      } else if (clientPrice > 0) {
        shipQuote = {
          provider: "zones",
          service: shippingFromClient?.service || "Tarifa fija",
          eta: shippingFromClient?.eta || "",
          price: clientPrice,
          deliveredType: "D",
          validTo: null,
        };
      } else {
        return NextResponse.json(
          { error: "Cotizá el envío antes de pagar." },
          { status: 400 }
        );
      }
    }
  }

  const shippingTotal = safeNum(shipQuote?.price || 0);

  // ✅ Si NO es local gratis, exigimos que sea > 0
  if (!shouldApplyFreeShipping && shippingTotal <= 0) {
    return NextResponse.json({ error: "Cotizá el envío antes de pagar." }, { status: 400 });
  }

  const total = itemsTotal + shippingTotal;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const externalReference = `order_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  // tracking headers
  const utm = {
    source: h(req, "x-utm-source"),
    medium: h(req, "x-utm-medium"),
    campaign: h(req, "x-utm-campaign"),
    term: h(req, "x-utm-term"),
    content: h(req, "x-utm-content"),
  };
  const path = h(req, "x-path");
  const ref = h(req, "x-ref");

  // response placeholder para setear sid
  const res = NextResponse.json({ ok: true });
  const sid = getOrCreateSid(req, res);

  // MP preference
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

  // publicCode unique
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

    // ✅ shippingData (no colisiona con buyer.shippingAddress)
    shippingData: {
      provider: shipQuote?.provider || "correo-argentino",
      deliveredType: shipQuote?.deliveredType || "D",
      postalCodeOrigin: originZip || process.env.NEXT_PUBLIC_CA_POSTAL_ORIGIN || "",
      postalCodeDestination: zip,
      quote: {
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

  // analytics server-side
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

  // respuesta final + preserva sid cookie
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