import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { requireAdminGuard } from "@/lib/adminAuth";

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req) {
  console.log("EXPORT GET HIT"); // 👈
  const guard = requireAdminGuard(req);
  if (guard) return guard;

  await connectDB();

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "";
  const shippingStatus = url.searchParams.get("shippingStatus") || "";

  const query = {};
  if (status) query.status = status;
  if (shippingStatus) query.shippingStatus = shippingStatus;

  const orders = await Order.find(query).sort({ createdAt: -1 }).limit(5000).lean();

  const rows = [
    ["createdAt","publicCode","status","shippingStatus","trackingCode","total","currency","buyerName","buyerPhone","buyerEmail","items"].join(","),
    ...orders.map(o => {
      const items = (o.items || []).map(it => `${it.qty}x ${it.slug}`).join(" | ");
      return [
        csvEscape(o.createdAt),
        csvEscape(o.publicCode),
        csvEscape(o.status),
        csvEscape(o.shippingStatus),
        csvEscape(o.trackingCode),
        csvEscape(o.total),
        csvEscape(o.currency),
        csvEscape(o.buyer?.name),
        csvEscape(o.buyer?.phone),
        csvEscape(o.buyer?.email),
        csvEscape(items),
      ].join(",");
    })
  ].join("\n");

  return new NextResponse(rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders.csv"`,
    },
  });
}
