import crypto from "crypto";

export function sha256(value) {
  if (!value) return undefined;
  const v = String(value).trim().toLowerCase();
  return crypto.createHash("sha256").update(v).digest("hex");
}