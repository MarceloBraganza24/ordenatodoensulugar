import { Buffer } from "buffer";

const BASE_URL = process.env.CA_BASE_URL;
const USERNAME = process.env.CA_USERNAME;
const PASSWORD = process.env.CA_PASSWORD;
const CUSTOMER_ID = process.env.CA_CUSTOMER_ID;
const POSTAL_CODE_ORIGIN = process.env.CA_POSTAL_CODE_ORIGIN;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function parseExpireToMs(expire) {
  if (!expire) return 0;

  // Soporta "2026-03-22 03:24:40"
  const normalized = String(expire).replace(" ", "T");
  const ms = new Date(normalized).getTime();

  return Number.isFinite(ms) ? ms : 0;
}

export async function getCorreoToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const basic = Buffer.from(
    `${requireEnv("CA_USERNAME", USERNAME)}:${requireEnv("CA_PASSWORD", PASSWORD)}`
  ).toString("base64");

  const res = await fetch(`${requireEnv("CA_BASE_URL", BASE_URL)}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.token) {
    throw new Error(
      `Correo token error: ${res.status} - ${JSON.stringify(data || {})}`
    );
  }

  cachedToken = data.token;

  const expireMs = parseExpireToMs(data.expire || data.expires);
  cachedTokenExpiresAt = expireMs ? expireMs - 60_000 : Date.now() + 14 * 60_000;

  return cachedToken;
}

export async function quoteCorreoShipment({
  postalCodeDestination,
  deliveredType,
  dimensions,
  forceOriginPostalCode,
}) {
  const token = await getCorreoToken();

  const payload = {
    customerId: requireEnv("CA_CUSTOMER_ID", CUSTOMER_ID),
    postalCodeOrigin:
      forceOriginPostalCode ||
      requireEnv("CA_POSTAL_CODE_ORIGIN", POSTAL_CODE_ORIGIN),
    postalCodeDestination: String(postalCodeDestination).trim(),
    dimensions: {
      weight: Math.round(Number(dimensions.weight)),
      height: Math.round(Number(dimensions.height)),
      width: Math.round(Number(dimensions.width)),
      length: Math.round(Number(dimensions.length)),
    },
  };

  // solo lo agregamos si viene definido
  if (deliveredType === "D" || deliveredType === "S") {
    payload.deliveredType = deliveredType;
  }

  // 🔥 DEBUG ANTES DEL FETCH
  console.log("CORREO base url:", requireEnv("CA_BASE_URL", BASE_URL));
  console.log("CORREO customerId:", requireEnv("CA_CUSTOMER_ID", CUSTOMER_ID));
  console.log(
    "CORREO origin postal code:",
    payload.postalCodeOrigin
  );
  console.log(
    "CORREO destination postal code:",
    payload.postalCodeDestination
  );
  console.log("CORREO deliveredType:", payload.deliveredType ?? null);
  console.log("CORREO dimensions:", payload.dimensions);

  console.log("CORREO /rates payload:", payload);

  const res = await fetch(`${requireEnv("CA_BASE_URL", BASE_URL)}/rates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  // 🔥 DEBUG RESPUESTA
  console.log("CORREO /rates status:", res.status);
  console.log(
    "CORREO /rates headers:",
    Object.fromEntries(res.headers.entries())
  );
  console.log(
    "CORREO /rates response:",
    JSON.stringify(data, null, 2)
  );

  if (!res.ok) {
    throw new Error(
      `Correo rates error: ${res.status} - ${JSON.stringify(data || {})}`
    );
  }

  return data;
}