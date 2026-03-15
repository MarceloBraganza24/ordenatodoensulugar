import crypto from "crypto";

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function genOtp6() {
  // 6 dígitos
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashOtp(email, otp) {
  // hash con secret para que no sea reversible
  const secret = process.env.JWT_SECRET || "dev_secret";
  return crypto.createHash("sha256").update(`${secret}:${email}:${otp}`).digest("hex");
}

export function getClientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xrip = req.headers.get("x-real-ip");
  if (xrip) return xrip.trim();
  return "unknown";
}
