import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";

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

export async function GET(req) {
  const email = getPortalEmail(req);
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();

    function escapeRegExp(str) {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    // ...

    const orders = await Order.find({
        "buyer.email": { $regex: new RegExp(`^${escapeRegExp(email)}$`, "i") },
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

  const safe = orders.map((o) => ({
    publicCode: o.publicCode,
    createdAt: o.createdAt,

    status: o.status,
    shippingStatus: o.shippingStatus,
    trackingCode: o.trackingCode,

    total: o.total,
    currency: o.currency,

    items: o.items,
    itemsTotal: o.itemsTotal,
    shippingTotal: o.shippingTotal,

    mp: {
      method: o.mp?.method || "",
      approvedAt: o.mp?.approvedAt || null,
    },

    buyer: {
      name: o.buyer?.name || "",
      email: o.buyer?.email || "",
      shippingAddress: o.buyer?.shippingAddress || o.buyer?.shipping || {},
    },

    shippingData: o.shippingData || {},
    shippingQuote: o.shippingQuote || {},
  }));

  return NextResponse.json({ ok: true, orders: safe });
}
