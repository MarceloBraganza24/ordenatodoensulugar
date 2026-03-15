import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { RegretRequest } from "@/models/RegretRequest";
import { getResend, getEmailFrom } from "@/lib/email";
import { getClientIp, normalizeEmail } from "@/lib/otp";

const Schema = z.object({
  orderCode: z.string().optional().nullable(),
  name: z.string().min(2, "Nombre requerido"),
  email: z.string().email(),
  dni: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

const onlyDigits = (s) => (s || "").replace(/\D/g, "");

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || null;

  const email = normalizeEmail(parsed.data.email);
  const name = parsed.data.name.trim();
  const orderCode = (parsed.data.orderCode || "").trim() || null;
  const dni = onlyDigits(parsed.data.dni || "") || null;
  const reason = (parsed.data.reason || "").trim() || null;

  await connectDB();

  // 1) Guardar en DB
  const saved = await RegretRequest.create({
    orderCode,
    name,
    email,
    dni,
    reason,
    ip,
    userAgent,
  });

  // 2) Enviar email (acción rápida)
  const resend = getResend();
  const from = getEmailFrom();

  const toAdmin = process.env.ARREPENTIMIENTO_TO_EMAIL;
  if (!toAdmin) {
    console.error("Missing ARREPENTIMIENTO_TO_EMAIL");
    return NextResponse.json({ error: "Config faltante" }, { status: 500 });
  }

  const subject = `Arrepentimiento de compra - ${orderCode ? `Pedido ${orderCode}` : "Sin pedido"} (${saved._id})`;

  const htmlAdmin = `
    <div style="font-family: Arial, sans-serif; line-height: 1.45">
      <h2>Solicitud de arrepentimiento</h2>
      <p><strong>ID:</strong> ${saved._id}</p>
      <p><strong>Pedido:</strong> ${orderCode || "-"}</p>
      <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>DNI:</strong> ${dni || "-"}</p>
      <p><strong>Motivo:</strong> ${reason ? escapeHtml(reason) : "-"}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:14px 0" />
      <p style="color:#334155"><strong>IP:</strong> ${ip || "-"}</p>
      <p style="color:#334155"><strong>User-Agent:</strong> ${escapeHtml(userAgent || "-")}</p>
    </div>
  `;

  const { error: errAdmin } = await resend.emails.send({
    from,
    to: toAdmin,
    subject,
    html: htmlAdmin,
    replyTo: email, // 👈 así respondés directo al cliente
  });

  if (errAdmin) {
    console.error("RESEND ADMIN ERROR:", errAdmin);
    // No “fallamos” la solicitud si ya quedó guardada en DB:
    return NextResponse.json({ ok: true, id: saved._id, warn: "email_failed" });
  }

  // (Opcional recomendado) confirmación al cliente
  const htmlClient = `
    <div style="font-family: Arial, sans-serif; line-height: 1.45">
      <h2>Recibimos tu solicitud</h2>
      <p>Hola ${escapeHtml(name)}, recibimos tu solicitud de arrepentimiento.</p>
      <p><strong>ID de seguimiento:</strong> ${saved._id}</p>
      <p>Te vamos a responder a la brevedad.</p>
      <p style="color:#64748b;font-size:12px;margin-top:12px">
        Si no realizaste esta solicitud, ignorá este mensaje.
      </p>
    </div>
  `;

  const { error: errClient } = await resend.emails.send({
    from,
    to: email,
    subject: "Recibimos tu solicitud de arrepentimiento",
    html: htmlClient,
  });

  if (errClient) {
    console.error("RESEND CLIENT ERROR:", errClient);
    // tampoco fallamos, ya está en DB + admin enviado
  }

  return NextResponse.json({ ok: true, id: saved._id });
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
