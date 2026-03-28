// /lib/shipping/correo.js
import { Buffer } from "buffer";

const CA_BASE_URL =
  process.env.CA_BASE_URL ||
  "https://apitest.correoargentino.com.ar/micorreo/v1";

const CA_USER = process.env.CA_USER || process.env.CA_USERNAME;
const CA_PASSWORD = process.env.CA_PASSWORD;
const CA_CUSTOMER_ID = process.env.CA_CUSTOMER_ID;
const CA_POSTAL_ORIGIN =
  process.env.CA_POSTAL_ORIGIN || process.env.CA_POSTAL_CODE_ORIGIN;

let tokenCache = {
  token: null,
  expiresAt: 0,
};

function assertEnv(name, value) {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function parseExpireToMs(expire) {
  if (!expire) return 0;
  const normalized = String(expire).replace(" ", "T");
  const ms = new Date(normalized).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/* =========================================
   1️⃣ TOKEN
========================================= */

async function getToken() {
  const now = Date.now();

  if (tokenCache.token && now < tokenCache.expiresAt - 30_000) {
    return tokenCache.token;
  }

  const user = assertEnv("CA_USER / CA_USERNAME", CA_USER);
  const password = assertEnv("CA_PASSWORD", CA_PASSWORD);

  const basic = Buffer.from(`${user}:${password}`).toString("base64");

  const res = await fetch(`${CA_BASE_URL}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Correo token error: ${res.status} ${txt}`);
  }

  const data = await res.json();

  const expireMs = parseExpireToMs(data?.expire || data?.expires);

  tokenCache = {
    token: data.token,
    expiresAt: expireMs || Date.now() + 10 * 60 * 1000,
  };

  return data.token;
}

/* =========================================
   2️⃣ DIMENSIONES
========================================= */

const PRODUCT_DIMENSIONS = {
  "organizador-acrilico-1100": {
    weight: 600,
    height: 12,
    width: 12,
    length: 20,
  },
  "cubiertero-bambu": {
    weight: 1200,
    height: 6,
    width: 35,
    length: 45,
  },
};

function computeCartDimensions(items) {
  let totalWeight = 0;
  let maxHeight = 0;
  let maxWidth = 0;
  let maxLength = 0;

  for (const item of items) {
    const dims = PRODUCT_DIMENSIONS[item.slug];
    if (!dims) continue;

    const qty = Number(item.qty || 0);

    totalWeight += dims.weight * qty;
    maxHeight = Math.max(maxHeight, dims.height);
    maxWidth = Math.max(maxWidth, dims.width);
    maxLength = Math.max(maxLength, dims.length);
  }

  if (totalWeight <= 0) {
    return {
      weight: 1500,
      height: 10,
      width: 20,
      length: 30,
    };
  }

  return {
    weight: Math.round(totalWeight),
    height: Math.round(maxHeight),
    width: Math.round(maxWidth),
    length: Math.round(maxLength),
  };
}

/* =========================================
   3️⃣ COTIZACIÓN PRINCIPAL
========================================= */

export async function quoteCorreo({
  postalCodeDestination,
  items,
  deliveredType = "D",
}) {
  const customerId = assertEnv("CA_CUSTOMER_ID", CA_CUSTOMER_ID);
  const postalCodeOrigin = assertEnv(
    "CA_POSTAL_ORIGIN / CA_POSTAL_CODE_ORIGIN",
    CA_POSTAL_ORIGIN
  );

  if (!postalCodeDestination) {
    throw new Error("Missing postalCodeDestination");
  }

  if (!Array.isArray(items) || !items.length) {
    throw new Error("Carrito vacío");
  }

  const token = await getToken();
  const dimensions = computeCartDimensions(items);

  const body = {
    customerId,
    postalCodeOrigin,
    postalCodeDestination: String(postalCodeDestination).trim(),
    deliveredType,
    dimensions,
  };

  const res = await fetch(`${CA_BASE_URL}/rates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      `Correo rates error: ${res.status} ${JSON.stringify(data)}`
    );
  }

  const rates = Array.isArray(data?.rates) ? data.rates : [];
  const best =
    rates.find((r) => r?.deliveredType === deliveredType) || rates[0] || null;

  if (!best) {
    throw new Error("Sin tarifas disponibles");
  }

  const price = Number(best.price || 0);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Tarifa inválida de Correo");
  }

  return {
    provider: "correo-argentino",
    service: best.productName || best.productType || "Correo Argentino",
    price,
    eta:
      best.deliveryTimeMin && best.deliveryTimeMax
        ? `${best.deliveryTimeMin}-${best.deliveryTimeMax} días`
        : "",
    deliveredType: best.deliveredType || deliveredType,
    raw: best,
    validTo: data.validTo || null,
  };
}