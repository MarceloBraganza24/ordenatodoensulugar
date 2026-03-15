import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { mpPreference } from "@/lib/mp";

function getPortalEmail(req) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");

  const token = req.cookies.get("order_portal_token")?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, secret);
    if (payload.kind !== "order_portal") return null;
    return payload.email;
  } catch {
    return null;
  }
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function pickShipping(order) {
  // compat: shippingData (nuevo) / shipping (viejo) / shippingQuote
  const sd = order?.shippingData || order?.shipping || {};
  const quote = sd?.quote || {};
  return {
    provider: sd?.provider || "",
    deliveredType: sd?.deliveredType || "",
    postalCodeOrigin: sd?.postalCodeOrigin || "",
    postalCodeDestination: sd?.postalCodeDestination || "",
    quote: {
      service: String(quote?.service || order?.shippingQuote?.service || ""),
      price: safeNum(quote?.price || order?.shippingTotal || 0),
      eta: String(quote?.eta || order?.shippingQuote?.eta || ""),
      validTo: quote?.validTo || null,
    },
  };
}

export async function GET(req, ctx) {
  const email = getPortalEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await ctx.params;

  await connectDB();

  const order = await Order.findOne({
    publicCode: code,
    "buyer.email": { $regex: new RegExp(`^${escapeRegExp(email)}$`, "i") },
  }).lean();

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const shipping = pickShipping(order);

  const canRetryPay =
    order.status === "pending" || order.status === "failed";

  return NextResponse.json({
    ok: true,
    order: {
      publicCode: order.publicCode,
      createdAt: order.createdAt,

      status: order.status,
      shippingStatus: order.shippingStatus,
      trackingCode: order.trackingCode,

      canRetryPay,

      itemsTotal: safeNum(order.itemsTotal),
      shippingTotal: safeNum(order.shippingTotal) || safeNum(shipping.quote.price),
      total: safeNum(order.total),
      currency: order.currency || "ARS",

      buyer: order.buyer || {},
      items: order.items || [],

      // ✅ para mostrar servicio/eta en UI
      shippingData: shipping,

      // ✅ para que el front decida mostrar "Completar pago"
      mp: {
        preferenceId: order?.mp?.preferenceId || "",
      },
    },
  });
}

/**
 * POST: regenerar preference para reintentar pago
 * Body opcional: { returnUrl?: string } (si querés)
 */
export async function POST(req, ctx) {
  const email = getPortalEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await ctx.params;

  await connectDB();

  const order = await Order.findOne({
    publicCode: code,
    "buyer.email": { $regex: new RegExp(`^${escapeRegExp(email)}$`, "i") },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Solo permitir reintentar si NO está pagado
  if (order.status === "paid") {
    return NextResponse.json({ error: "La orden ya está pagada." }, { status: 400 });
  }

  if (order.status === "refunded") {
    return NextResponse.json({ error: "La orden no admite reintento de pago." }, { status: 400 });
  }

  if (!["pending", "failed"].includes(order.status)) {
    return NextResponse.json(
      { error: "Esta orden no se puede pagar nuevamente." },
      { status: 400 }
    );
  }

  const shipping = pickShipping(order);
  const shippingTotal =
    safeNum(order.shippingTotal) || safeNum(shipping.quote.price);
  const itemsTotal = safeNum(order.itemsTotal);
  const total = safeNum(order.total) || (itemsTotal + shippingTotal);

  const shippingLabel = [
    shipping?.provider || "Envío",
    shipping?.quote?.service || "",
  ].filter(Boolean).join(" - ");

  // Construimos ítems MP desde la order (ya no dependemos de Product)
  const mpItems = [
    ...(order.items || []).map((it) => ({
      id: it.slug || String(it.productId || ""),
      title: it.title || "Producto",
      quantity: safeNum(it.qty) || 1,
      unit_price: safeNum(it.unitPrice),
      currency_id: order.currency || "ARS",
    })),
    ...(shippingTotal > 0
      ? [{
          id: "shipping",
          title: `Envío - ${shippingLabel}`,
          quantity: 1,
          unit_price: shippingTotal,
          currency_id: order.currency || "ARS",
        }]
      : []),
  ];

  if (!order.items?.length) {
    return NextResponse.json(
      { error: "La orden no tiene productos para pagar." },
      { status: 400 }
    );
  }

  if (total <= 0) {
    return NextResponse.json(
      { error: "La orden tiene un total inválido." },
      { status: 400 }
    );
  }

  const now = Date.now();
  const lastPrefAt = order?.mp?.lastPreferenceCreatedAt
    ? new Date(order.mp.lastPreferenceCreatedAt).getTime()
    : 0;

  const RETRY_COOLDOWN_MS = 30 * 1000;

  if (lastPrefAt && now - lastPrefAt < RETRY_COOLDOWN_MS) {
    return NextResponse.json(
      { error: "Esperá unos segundos antes de volver a intentar." },
      { status: 429 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const externalReference = order.externalReference; // reutilizamos el mismo

  const preference = await mpPreference().create({
    body: {
      items: mpItems,
      back_urls: {
        success: `${siteUrl}/pedido?code=${encodeURIComponent(order.publicCode)}`,
        pending: `${siteUrl}/pedido?code=${encodeURIComponent(order.publicCode)}`,
        failure: `${siteUrl}/pedido?code=${encodeURIComponent(order.publicCode)}`,
      },
      auto_return: "approved",
      notification_url: `${siteUrl}/api/webhooks/mercadopago`,
      external_reference: externalReference,
    },
  });

  // Guardamos la nueva preferenceId (y reseteamos mismatch si querés)
  order.mp = order.mp || {};
  order.mp.preferenceId = preference.id;
  order.mp.lastPreferenceCreatedAt = new Date();
  order.mp.mismatch = { paidAmount: 0, expectedAmount: total };
  await order.save();

  return NextResponse.json({
    ok: true,
    init_point: preference.init_point,
    preferenceId: preference.id,
  });
}
