import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

let _resend = null;

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Missing RESEND_API_KEY");
  if (_resend) return _resend;
  _resend = new Resend(key);
  return _resend;
}

export function getEmailFrom() {
  // En prod conviene obligarlo (dominio verificado)
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  return from;
}

export async function sendOrderPaidEmail(args = {}) {
  const { to, order, orderUrl } = args;

  if (!to || !orderUrl || !order?.publicCode) {
    console.error("sendOrderPaidEmail called with invalid args:", args);
    throw new Error("sendOrderPaidEmail missing params");
  }

  const resend = getResend();
  const from = getEmailFrom();

  const itemsHtml = (order.items || [])
    .map((it) => `<li>${it.qty} × ${escapeHtml(it.title)} — ${it.unitPrice} ARS</li>`)
    .join("");

  const html = `
  <div style="font-family: Arial, sans-serif; line-height: 1.5">
    <h2>¡Pago confirmado! ✅</h2>
    <p>Gracias por tu compra. Este es el resumen de tu pedido:</p>

    <p><b>Pedido:</b> ${escapeHtml(order.publicCode)}</p>
    <p><b>Total:</b> ${order.total} ${escapeHtml(order.currency || "ARS")}</p>

    <h3>Productos</h3>
    <ul>${itemsHtml}</ul>

    <p>
      <a href="${orderUrl}" style="display:inline-block;padding:10px 14px;text-decoration:none;border-radius:8px;border:1px solid #111;color:#111">
        Seguimiento de mi pedido
      </a>
    </p>

    <p style="font-size:12px;color:#666">
      Si no fuiste vos, ignorá este correo.
    </p>
  </div>`;

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: `Pago confirmado - Pedido ${order.publicCode}`,
    html,
  });

  if (error) throw error;
  return data;
}

export async function sendOrderShippedEmail({
  to,
  buyerName,
  orderCode,
  trackingCode,
}) {
  if (!to) return;

  const trackingHtml = trackingCode
    ? `<p><strong>Código de seguimiento:</strong> ${trackingCode}</p>`
    : "";

  const orderUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/pedido/${orderCode}`;

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Tu pedido de ORDENA ya fue despachado 📦",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6;">
        <h2 style="margin-bottom: 8px;">¡Tu pedido ya fue despachado!</h2>
        <p>Hola ${buyerName || ""},</p>
        <p>
          Queremos avisarte que tu pedido de <strong>ORDENA</strong>
          ya fue despachado y pronto estará en camino.
        </p>
        <p><strong>Número de pedido:</strong> ${orderCode || "-"}</p>
        ${trackingHtml}
        <p>
          Podés revisar el estado de tu pedido haciendo click <a href={${orderUrl}}>aquí</a>.
        </p>
        <p>
          Gracias por tu compra 💛
        </p>
        <p style="margin-top: 24px;">
          Equipo ORDENA
        </p>
      </div>
    `,
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
