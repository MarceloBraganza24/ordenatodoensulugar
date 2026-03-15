import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { DailyMetric } from "@/models/DailyMetric";
import { requireAdminGuard } from "@/lib/adminAuth";

function parseDay(s) {
  if (!s || typeof s !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function dayRange(from, to) {
  const res = [];
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    res.push(`${yyyy}-${mm}-${dd}`);
  }
  return res;
}

export async function GET(req) {
  const guard = requireAdminGuard(req);
  if (guard) return guard;

  const url = new URL(req.url);
  const fromQ = parseDay(url.searchParams.get("from"));
  const toQ = parseDay(url.searchParams.get("to"));

  // default: últimos 14 días
  const today = new Date();
  const to =
    toQ ||
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

  const fromDate = new Date(to + "T00:00:00");
  fromDate.setDate(fromDate.getDate() - 13);
  const from =
    fromQ ||
    `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-${String(
      fromDate.getDate()
    ).padStart(2, "0")}`;

  await connectDB();

  const docs = await DailyMetric.find({ day: { $gte: from, $lte: to } })
    .sort({ day: 1 })
    .lean();

  const byDay = new Map(docs.map((d) => [d.day, d]));

  const days = dayRange(from, to).map((day) => {
    const d = byDay.get(day);
    const counters = d?.counters || {};
    const get = (k) => Number(counters?.get?.(k) ?? counters?.[k] ?? 0);

    return {
      day,
      page_view: get("page_view"),
      view_item: get("view_item"),
      add_to_cart: get("add_to_cart"),
      begin_checkout: get("begin_checkout"),
      redirect_to_mp: get("redirect_to_mp"),
      purchase_paid: get("purchase_paid"),

      // gross
      revenuePaid: Number(d?.revenuePaid || 0),
      ordersPaid: Number(d?.ordersPaid || 0),

      // ✅ nuevos
      netPaid: Number(d?.netPaid || 0),
      feesPaid: Number(d?.feesPaid || 0),
    };
  });

  const totals = days.reduce(
    (acc, d) => {
      acc.page_view += d.page_view;
      acc.view_item += d.view_item;
      acc.add_to_cart += d.add_to_cart;
      acc.begin_checkout += d.begin_checkout;
      acc.redirect_to_mp += d.redirect_to_mp;
      acc.purchase_paid += d.purchase_paid;

      acc.revenuePaid += d.revenuePaid;
      acc.ordersPaid += d.ordersPaid;

      // ✅ nuevos
      acc.netPaid += d.netPaid;
      acc.feesPaid += d.feesPaid;

      return acc;
    },
    {
      page_view: 0,
      view_item: 0,
      add_to_cart: 0,
      begin_checkout: 0,
      redirect_to_mp: 0,
      purchase_paid: 0,

      revenuePaid: 0,
      ordersPaid: 0,

      // ✅ nuevos
      netPaid: 0,
      feesPaid: 0,
    }
  );

  const conversion = {
    landing_to_cart: totals.page_view ? totals.add_to_cart / totals.page_view : 0,
    cart_to_checkout: totals.add_to_cart ? totals.begin_checkout / totals.add_to_cart : 0,
    checkout_to_paid: totals.begin_checkout ? totals.ordersPaid / totals.begin_checkout : 0,
    landing_to_paid: totals.page_view ? totals.ordersPaid / totals.page_view : 0,

    // AOV gross (ya lo tenías)
    aov: totals.ordersPaid ? totals.revenuePaid / totals.ordersPaid : 0,

    // ✅ opcional: AOV neto (útil para vos)
    aovNet: totals.ordersPaid ? totals.netPaid / totals.ordersPaid : 0,
  };

  return NextResponse.json({ ok: true, from, to, totals, conversion, days });
}