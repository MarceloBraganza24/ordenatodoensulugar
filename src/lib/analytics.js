// src/lib/analytics.js
import crypto from "crypto";

/**
 * YYYY-MM-DD en UTC (estable para deploy / métricas)
 */
export function dayKey(d = new Date()) {
  const x = new Date(d);
  const yyyy = x.getUTCFullYear();
  const mm = String(x.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(x.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function sha256(str) {
  return crypto
    .createHash("sha256")
    .update(String(str ?? ""))
    .digest("hex");
}

export function getSid(req) {
  return req?.cookies?.get("sid")?.value || "";
}

export function ensureSidCookie(res, sid) {
  if (!sid || !res?.cookies?.set) return;

  // 90 días
  res.cookies.set("sid", sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export function newSid() {
  return crypto.randomBytes(16).toString("hex");
}

export function getOrCreateSid(req, res) {
  const sid = getSid(req) || newSid();
  ensureSidCookie(res, sid);
  return sid;
}

export const ALLOWED_EVENTS = new Set([
  "page_view",
  "view_item",
  "add_to_cart",
  "begin_checkout",
  "redirect_to_mp",
  "purchase_paid",
  "purchase_item_paid",
  "purchase_failed",
  "otp_requested",
  "otp_verified",
]);
