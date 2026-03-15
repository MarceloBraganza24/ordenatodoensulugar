import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";

export async function GET(req) {
  const url = new URL(req.url);
  const externalReference = url.searchParams.get("externalReference");

  if (!externalReference) {
    return NextResponse.json({ error: "Missing externalReference" }, { status: 400 });
  }

  await connectDB();

  const order = await Order.findOne({ externalReference }).lean();
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    publicCode: order.publicCode,
    accessKey: order.accessKey,
    status: order.status,
    shippingStatus: order.shippingStatus,
    total: order.total,
    currency: order.currency,
  });
}
