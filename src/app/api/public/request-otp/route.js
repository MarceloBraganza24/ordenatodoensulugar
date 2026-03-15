import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Otp } from "@/models/Otp";
import { getResend, getEmailFrom } from "@/lib/email";
import { genOtp6, hashOtp, normalizeEmail, getClientIp } from "@/lib/otp";

const Schema = z.object({
  email: z.string().email(),
});

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Email inválido" }, { status: 400 });

  const email = normalizeEmail(parsed.data.email);
  const ip = getClientIp(req);

  await connectDB();

  // “soft rate limit” por email: 1 OTP activo a la vez (reemplaza el anterior)
  await Otp.deleteMany({ email });

  const otp = genOtp6();
  const codeHash = hashOtp(email, otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await Otp.create({ email, codeHash, expiresAt, attempts: 0, maxAttempts: 8, ip });

  const resend = getResend();
  const from = getEmailFrom();

  const { data, error } = await resend.emails.send({
    from,
    to: email,
    subject: "Tu código para ver tus pedidos",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.4">
        <h2>Tu código de acceso</h2>
        <p>Usá este código para ver tus pedidos:</p>
        <p style="font-size: 28px; letter-spacing: 4px; font-weight: bold">${otp}</p>
        <p>Vence en 10 minutos.</p>
        <p>Si no fuiste vos, podés ignorar este email.</p>
      </div>
    `,
  });

  if (error) {
    console.error("RESEND ERROR:", error);
    return NextResponse.json({ error: "Email provider error", details: error }, { status: 500 });
  }

  console.log("RESEND SENT:", data);

  return NextResponse.json({ ok: true });
}
