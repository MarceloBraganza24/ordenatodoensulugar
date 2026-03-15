// app/api/order-status/by-external/[externalReference]/route.js
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";

export async function GET(req, ctx) {
  const { externalReference } = await ctx.params;
  const ext = String(externalReference || "").trim();
  if (!ext) return NextResponse.json({ error: "Missing externalReference" }, { status: 400 });

  await connectDB();

  const order = await Order.findOne({ externalReference: ext })
    .select("publicCode accessKey status buyer.email")
    .lean();

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    publicCode: order.publicCode,
    accessKey: order.accessKey,
    status: order.status,
  });
}