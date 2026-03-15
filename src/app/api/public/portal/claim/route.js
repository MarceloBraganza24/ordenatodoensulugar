import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { headers } from "next/headers";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { hitLimit } from "@/lib/rateLimit";

function safeStr(x) {
  return typeof x === "string" ? x : "";
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function getClientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "Missing JWT_SECRET" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const publicCode = safeStr(body.publicCode).trim();
    const accessKey = safeStr(body.accessKey).trim();

    if (!publicCode || !accessKey) {
      return NextResponse.json(
        { ok: false, error: "Missing params" },
        { status: 400 }
      );
    }

    // ✅ Rate limit (anti-bruteforce)
    const ip = getClientIp(req);

    // 20 intentos por IP cada 10 min
    const rIp = hitLimit(`portal_claim:ip:${ip}`, 20, 10 * 60 * 1000);
    if (!rIp.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many attempts" },
        { status: 429 }
      );
    }

    // 8 intentos por publicCode cada 10 min (evita atacar 1 código puntual)
    const rCode = hitLimit(`portal_claim:code:${publicCode}`, 8, 10 * 60 * 1000);
    if (!rCode.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many attempts" },
        { status: 429 }
      );
    }

    await connectDB();

    const order = await Order.findOne({ publicCode }).lean();

    // ✅ Respuesta uniforme: no revelar si existe o no existe
    if (!order || !safeEqual(order.accessKey, accessKey)) {
      return NextResponse.json(
        { ok: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const email = safeStr(order?.buyer?.email).toLowerCase().trim();
    if (!email) {
      // esto sí es un error real del dato
      return NextResponse.json(
        { ok: false, error: "Order missing buyer email" },
        { status: 400 }
      );
    }

    const token = jwt.sign(
      { kind: "order_portal", email },
      secret,
      { expiresIn: "30d" }
    );

    const res = NextResponse.json({ ok: true });

    res.cookies.set("order_portal_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (e) {
    console.error("[portal/claim] failed:", e);
    return NextResponse.json(
      { ok: false, error: "Claim failed" },
      { status: 500 }
    );
  }
}