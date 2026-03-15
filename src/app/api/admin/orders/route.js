import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";

function requireAdmin(req) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");

  const token = req.cookies.get("admin_token")?.value;
  if (!token) return null;

  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

export async function GET(req) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

  const url = new URL(req.url);

  const status = url.searchParams.get("status"); // paid/pending/failed
  const shippingStatus = url.searchParams.get("shippingStatus"); // pending/shipped/delivered
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(Number(url.searchParams.get("limit") || 200), 500);

  const query = {};
  if (status) query.status = status;
  if (shippingStatus) query.shippingStatus = shippingStatus;

  // búsqueda simple: buyer (name/phone/email) + orderId
  if (q) {
    const or = [];

    if (q.length >= 6) {
      // permite buscar por pedacito del _id
      or.push({ _id: q.match(/^[0-9a-fA-F]{24}$/) ? q : undefined });
    }

    or.push({ "buyer.name": { $regex: q, $options: "i" } });
    or.push({ "buyer.phone": { $regex: q, $options: "i" } });
    or.push({ "buyer.email": { $regex: q, $options: "i" } });
    or.push({ trackingCode: { $regex: q, $options: "i" } });

    query.$or = or.filter(Boolean);
  }

  const orders = await Order.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  return NextResponse.json({ ok: true, orders });
}
