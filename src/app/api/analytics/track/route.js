import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { AnalyticsEvent } from "@/models/AnalyticsEvent";
import { DailyMetric } from "@/models/DailyMetric";
import { ALLOWED_EVENTS, dayKey, getSid, newSid, ensureSidCookie, sha256 } from "@/lib/analytics";

const Schema = z.object({
  type: z.string().min(1),
  path: z.string().optional(),
  ref: z.string().optional(),
  utm: z.object({
    source: z.string().optional(),
    medium: z.string().optional(),
    campaign: z.string().optional(),
    term: z.string().optional(),
    content: z.string().optional(),
  }).optional(),
  product: z.object({
    slug: z.string().optional(),
    title: z.string().optional(),
    price: z.number().optional(),
    qty: z.number().optional(),
  }).optional(),
  order: z.object({
    publicCode: z.string().optional(),
    total: z.number().optional(),
    currency: z.string().optional(),
    status: z.string().optional(),
  }).optional(),
  meta: z.any().optional(),
});

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { type } = parsed.data;
  if (!ALLOWED_EVENTS.has(type)) return NextResponse.json({ ok: true });

  await connectDB();

  // sid cookie
  let sid = getSid(req);
  const res = NextResponse.json({ ok: true });

  if (!sid) {
    sid = newSid();
    ensureSidCookie(res, sid);
  }

  // privacy
  const ip = req.headers.get("x-forwarded-for") || "";
  const ua = req.headers.get("user-agent") || "";

  const ev = {
    type,
    ts: new Date(),
    sid,
    path: parsed.data.path || "",
    ref: parsed.data.ref || "",
    utm: parsed.data.utm || {},
    product: parsed.data.product || null,
    order: parsed.data.order || null,
    meta: parsed.data.meta || {},
    ipHash: sha256(ip),
    uaHash: sha256(ua),
  };

  await AnalyticsEvent.create(ev);

  // Agregado diario incremental
  const dkey = dayKey(ev.ts);
  const inc = {
    [`counters.${type}`]: 1,
  };

  // si el evento viene con producto
  if (ev.product?.slug && Number(ev.product?.qty || 0) > 0) {
    inc[`itemsBySlug.${ev.product.slug}`] = Number(ev.product.qty || 0);
    if (typeof ev.product.price === "number") {
      inc[`revenueBySlug.${ev.product.slug}`] = Number(ev.product.price || 0) * Number(ev.product.qty || 1);
    }
  }

  // si es purchase_paid (en general lo vas a loguear server-side, pero igual)
  if (type === "purchase_paid" && typeof ev.order?.total === "number") {
    inc.ordersPaid = 1;
    inc.revenuePaid = Number(ev.order.total || 0);

    const src = ev.utm?.source || "direct";
    const camp = ev.utm?.campaign || "none";
    const key = `${src}|${camp}`;
    inc[`utmRevenue.${key}`] = Number(ev.order.total || 0);
  }

  await DailyMetric.updateOne(
    { day: dkey },
    { $inc: inc, $setOnInsert: { day: dkey } },
    { upsert: true }
  );

  return res;
}
