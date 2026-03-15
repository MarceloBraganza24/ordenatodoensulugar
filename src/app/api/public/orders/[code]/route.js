import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";

export async function GET(req, ctx) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 401 });

  await connectDB();

  const order = await Order.findOne({ publicCode: code }).lean();
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (order.accessKey !== key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ⚠️ No devolvemos adminNotes al cliente
  return NextResponse.json({
    ok: true,
    order: {
      publicCode: order.publicCode,
      status: order.status,
      createdAt: order.createdAt,
      total: order.total,
      currency: order.currency,
      buyer: order.buyer || {},
      items: order.items || [],
      shippingStatus: order.shippingStatus,
      trackingCode: order.trackingCode,
    },
  });
}
