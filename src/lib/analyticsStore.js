import { connectDB } from "@/lib/db";
import { AnalyticsEvent } from "@/models/AnalyticsEvent";
import { DailyMetric } from "@/models/DailyMetric";
import { dayKey } from "@/lib/analytics";

function safeStr(x) {
  return typeof x === "string" ? x : "";
}

function utmKey(utm = {}) {
  const src = safeStr(utm.source) || "direct";
  const camp = safeStr(utm.campaign) || "none";
  return `${src}|${camp}`;
}

/**
 * Guarda evento + agrega incremental DailyMetric.
 * server-side (checkout/webhook/admin)
 */
export async function recordEvent({
  type,
  ts = new Date(),
  sid = "",
  path = "",
  ref = "",
  utm = {},
  product = null,
  order = null,
  meta = {},
}) {
  await connectDB();

  const ev = {
    type,
    ts,
    sid,
    path,
    ref,
    utm: utm || {},
    product: product || null,
    order: order || null,
    meta: meta || {},
  };

  await AnalyticsEvent.create(ev);

  const dkey = dayKey(ts);

  const inc = {
    [`counters.${type}`]: 1,
  };

  // si hay producto
  if (product?.slug && Number(product?.qty || 0) > 0) {
    inc[`itemsBySlug.${product.slug}`] = Number(product.qty || 0);
    if (typeof product.price === "number") {
      inc[`revenueBySlug.${product.slug}`] =
        Number(product.price || 0) * Number(product.qty || 1);
    }
  }

  // compras pagas
  if (type === "purchase_paid" && typeof order?.total === "number") {
    inc.ordersPaid = 1;
    inc.revenuePaid = Number(order.total || 0);

    if (typeof meta?.netAmount === "number") inc.netPaid = Number(meta.netAmount || 0);
    if (typeof meta?.feeAmount === "number") inc.feesPaid = Number(meta.feeAmount || 0);

    const key = utmKey(utm);
    inc[`utmRevenue.${key}`] = Number(order.total || 0);
  }

  await DailyMetric.updateOne(
    { day: dkey },
    { $inc: inc, $setOnInsert: { day: dkey } },
    { upsert: true }
  );
}
