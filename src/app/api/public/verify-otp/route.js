import { NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/db";
import { Otp } from "@/models/Otp";
import { hashOtp, normalizeEmail } from "@/lib/otp";

const Schema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(6),
});

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const email = normalizeEmail(parsed.data.email);
  const code = parsed.data.code;

  await connectDB();

  const otpRow = await Otp.findOne({ email });
  if (!otpRow) return NextResponse.json({ error: "Código expirado o inválido" }, { status: 401 });

  if (new Date() > otpRow.expiresAt) {
    await Otp.deleteOne({ _id: otpRow._id });
    return NextResponse.json({ error: "Código expirado" }, { status: 401 });
  }

  if (otpRow.attempts >= otpRow.maxAttempts) {
    await Otp.deleteOne({ _id: otpRow._id });
    return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  }

  const expected = otpRow.codeHash;
  const got = hashOtp(email, code);

  if (got !== expected) {
    otpRow.attempts += 1;
    await otpRow.save();
    return NextResponse.json({ error: "Código incorrecto" }, { status: 401 });
  }

  // OK: borrar OTP y emitir cookie JWT
  await Otp.deleteOne({ _id: otpRow._id });

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");

  const token = jwt.sign(
    { email, kind: "order_portal" },
    secret,
    { expiresIn: "7d" }
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set("order_portal_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
