// /lib/shipping/correo.js

const CA_BASE_URL =
  process.env.CA_BASE_URL ||
  "https://apitest.correoargentino.com.ar/micorreo/v1";

const CA_USER = process.env.CA_USER;
const CA_PASSWORD = process.env.CA_PASSWORD;
const CA_CUSTOMER_ID = process.env.CA_CUSTOMER_ID;
const CA_POSTAL_ORIGIN = process.env.CA_POSTAL_ORIGIN;

let tokenCache = {
  token: null,
  expiresAt: 0,
};

function assertEnv(name, value) {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

/* =========================================
   1️⃣ TOKEN
========================================= */

async function getToken() {
  const now = Date.now();

  if (tokenCache.token && now < tokenCache.expiresAt - 30_000) {
    return tokenCache.token;
  }

  assertEnv("CA_USER", CA_USER);
  assertEnv("CA_PASSWORD", CA_PASSWORD);

  const basic = Buffer.from(`${CA_USER}:${CA_PASSWORD}`).toString("base64");

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

  tokenCache = {
    token: data.token,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
  };

  return data.token;
}

/* =========================================
   2️⃣ DIMENSIONES (ajustar a tus productos)
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
    // fallback seguro
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
  assertEnv("CA_CUSTOMER_ID", CA_CUSTOMER_ID);
  assertEnv("CA_POSTAL_ORIGIN", CA_POSTAL_ORIGIN);

  if (!postalCodeDestination) {
    throw new Error("Missing postalCodeDestination");
  }

  if (!Array.isArray(items) || !items.length) {
    throw new Error("Carrito vacío");
  }

  const token = await getToken();

  const dimensions = computeCartDimensions(items);

  const body = {
    customerId: CA_CUSTOMER_ID,
    postalCodeOrigin: CA_POSTAL_ORIGIN,
    postalCodeDestination,
    deliveredType, // "D" domicilio, "S" sucursal
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

  const best = data?.rates?.[0];

  if (!best) {
    throw new Error("Sin tarifas disponibles");
  }

  return {
    provider: "correo-argentino",
    service: best.productName || best.productType,
    price: Number(best.price || 0),
    eta:
      best.deliveryTimeMin && best.deliveryTimeMax
        ? `${best.deliveryTimeMin}-${best.deliveryTimeMax} días`
        : null,
    deliveredType: best.deliveredType,
    raw: best,
    validTo: data.validTo,
  };
}