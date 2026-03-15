import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";

export async function POST(req) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return NextResponse.json({ error: "Missing JWT_SECRET" }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim();
    const key = String(body.key || "").trim();

    if (!code || !key) {
      return NextResponse.json({ error: "Missing code/key" }, { status: 400 });
    }

    await connectDB();

    const order = await Order.findOne({ publicCode: code }).lean();
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Validación del link
    if (String(order.accessKey) !== key) {
      return NextResponse.json({ error: "Invalid key" }, { status: 403 });
    }

    const email = String(order?.buyer?.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Order has no buyer email" }, { status: 400 });
    }

    // Emitimos el mismo token que OTP (portal)
    const token = jwt.sign(
      { kind: "order_portal", email },
      secret,
      { expiresIn: "24h" } // ajustá: "2h" si querés más privacidad
    );

    const res = NextResponse.json({ ok: true });

    res.cookies.set("order_portal_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 24h
    });

    return res;
  } catch (e) {
    console.error("login-from-link error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
