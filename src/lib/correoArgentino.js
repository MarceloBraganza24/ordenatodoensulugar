import { Buffer } from "buffer";

const BASE_URL = process.env.CA_BASE_URL;
const USERNAME = process.env.CA_USERNAME;
const PASSWORD = process.env.CA_PASSWORD;
const CUSTOMER_ID = process.env.CA_CUSTOMER_ID;
const POSTAL_CODE_ORIGIN = process.env.CA_POSTAL_CODE_ORIGIN;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

let ratesCache = new Map();
const RATES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function parseExpireToMs(expire) {
  if (!expire) return 0;
  const normalized = String(expire).replace(" ", "T");
  const ms = new Date(normalized).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeCustomerId(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  return digits.padStart(10, "0");
}

function normalizePostalCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

function normalizeDimensions(dimensions = {}) {
  return {
    weight: Math.round(Number(dimensions?.weight || 0)),
    height: Math.round(Number(dimensions?.height || 0)),
    width: Math.round(Number(dimensions?.width || 0)),
    length: Math.round(Number(dimensions?.length || 0)),
  };
}

function maskToken(token) {
  const t = String(token || "");
  if (t.length <= 16) return "***";
  return `${t.slice(0, 10)}...${t.slice(-6)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortLikeError(error) {
  const msg = String(error?.message || "").toLowerCase();
  const name = String(error?.name || "").toLowerCase();
  const causeCode = String(error?.cause?.code || "").toLowerCase();

  return (
    name.includes("abort") ||
    msg.includes("aborted") ||
    msg.includes("timeout") ||
    causeCode.includes("timeout")
  );
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  if (!timeoutMs || timeoutMs <= 0) {
    return await fetch(url, options);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(
  url,
  options,
  {
    retries = 1,
    timeoutMs = 10000,
    retryDelayMs = 400,
    logLabel = "correo",
  } = {}
) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeoutMs);
    } catch (error) {
      lastError = error;

      const currentAttempt = attempt + 1;
      const totalAttempts = retries + 1;

      console.warn(`[${logLabel}] retry ${currentAttempt}/${totalAttempts}`, {
        message: error?.message,
        name: error?.name,
        cause: error?.cause,
      });

      if (attempt < retries) {
        await sleep(retryDelayMs * currentAttempt);
      }
    }
  }

  throw lastError;
}

function clearExpiredRatesCache() {
  const now = Date.now();

  for (const [key, entry] of ratesCache.entries()) {
    if (!entry || now > entry.expiresAt) {
      ratesCache.delete(key);
    }
  }
}

function buildRatesCacheKey({
  postalCodeDestination,
  deliveredType,
  dimensions,
  forceOriginPostalCode,
}) {
  return JSON.stringify({
    postalCodeOrigin: normalizePostalCode(
      forceOriginPostalCode || POSTAL_CODE_ORIGIN
    ),
    postalCodeDestination: normalizePostalCode(postalCodeDestination),
    deliveredType: deliveredType || "D",
    dimensions: normalizeDimensions(dimensions),
  });
}

function getCachedRates(cacheKey) {
  const entry = ratesCache.get(cacheKey);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    ratesCache.delete(cacheKey);
    return null;
  }

  return entry.data;
}

function setCachedRates(cacheKey, data) {
  ratesCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + RATES_CACHE_TTL_MS,
  });
}

async function fetchCorreoTokenOnce() {
  const basic = Buffer.from(
    `${requireEnv("CA_USERNAME", USERNAME)}:${requireEnv("CA_PASSWORD", PASSWORD)}`
  ).toString("base64");

  return await fetchWithRetry(
    `${requireEnv("CA_BASE_URL", BASE_URL)}/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
      },
      cache: "no-store",
    },
    {
      retries: 0,
      timeoutMs: 1200,
      retryDelayMs: 0,
      logLabel: "correo-token",
    }
  );
}

export async function getCorreoToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  try {
    const res = await fetchCorreoTokenOnce();
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.token) {
      throw new Error(
        `Correo token error: ${res.status} - ${JSON.stringify(data || {})}`
      );
    }

    cachedToken = data.token;

    const expireMs = parseExpireToMs(data.expire || data.expires);
    cachedTokenExpiresAt = expireMs
      ? expireMs - 60_000
      : Date.now() + 14 * 60 * 1000;

    /* if (process.env.NODE_ENV !== "production") {
      console.log("[correo] token generado", {
        baseUrl: requireEnv("CA_BASE_URL", BASE_URL),
        tokenPreview: maskToken(cachedToken),
        expiresAt: cachedTokenExpiresAt,
      });
    } */

    return cachedToken;
  } catch (error) {
    console.error("[correo] error obteniendo token", {
      message: error?.message,
      name: error?.name,
      cause: error?.cause,
      stack: error?.stack,
      baseUrl: requireEnv("CA_BASE_URL", BASE_URL),
      abortLike: isAbortLikeError(error),
    });
    throw error;
  }
}

function getPayload({
  postalCodeDestination,
  deliveredType,
  dimensions,
  forceOriginPostalCode,
}) {
  const customerIdRaw = requireEnv("CA_CUSTOMER_ID", CUSTOMER_ID);
  const customerId = normalizeCustomerId(customerIdRaw);

  const originRaw =
    forceOriginPostalCode ||
    requireEnv("CA_POSTAL_CODE_ORIGIN", POSTAL_CODE_ORIGIN);

  const postalCodeOrigin = normalizePostalCode(originRaw);
  const postalCodeDestinationNormalized =
    normalizePostalCode(postalCodeDestination);

  if (!postalCodeOrigin) {
    throw new Error("CA_POSTAL_CODE_ORIGIN inválido");
  }

  if (!postalCodeDestinationNormalized) {
    throw new Error("postalCodeDestination inválido");
  }

  const normalizedDims = normalizeDimensions(dimensions);

  const payload = {
    customerId,
    postalCodeOrigin,
    postalCodeDestination: postalCodeDestinationNormalized,
    dimensions: normalizedDims,
  };

  if (deliveredType === "D" || deliveredType === "S") {
    payload.deliveredType = deliveredType;
  }

  return {
    payload,
    debug: {
      customerIdRaw,
      customerIdNormalized: customerId,
      originRaw,
      postalCodeOrigin,
      postalCodeDestination: payload.postalCodeDestination,
      deliveredType: payload.deliveredType ?? null,
      dimensions: payload.dimensions,
    },
  };
}

async function fetchRatesOnce(url, token, payload) {
  return await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
    {
      retries: 0,
      timeoutMs: 1500,
      retryDelayMs: 0,
      logLabel: "correo-rates",
    }
  );
}

export async function quoteCorreoRatesRaw({
  postalCodeDestination,
  deliveredType = "D",
  dimensions,
  forceOriginPostalCode,
}) {
  clearExpiredRatesCache();

  const cacheKey = buildRatesCacheKey({
    postalCodeDestination,
    deliveredType,
    dimensions,
    forceOriginPostalCode,
  });

  const cached = getCachedRates(cacheKey);
  if (cached) {
    /* if (process.env.NODE_ENV !== "production") {
      console.log("[correo] /rates cache HIT", {
        postalCodeDestination: normalizePostalCode(postalCodeDestination),
        deliveredType,
      });
    } */
    return cached;
  }

  const token = await getCorreoToken();

  const { payload, debug } = getPayload({
    postalCodeDestination,
    deliveredType,
    dimensions,
    forceOriginPostalCode,
  });

  /* if (process.env.NODE_ENV !== "production") {
    console.log("[correo] /rates request", {
      url: `${requireEnv("CA_BASE_URL", BASE_URL)}/rates`,
      ...debug,
      tokenPreview: maskToken(token),
    });
  } */

  try {
    const res = await fetchRatesOnce(
      `${requireEnv("CA_BASE_URL", BASE_URL)}/rates`,
      token,
      payload
    );

    const data = await res.json().catch(() => null);

    /* if (process.env.NODE_ENV !== "production") {
      console.log("[correo] /rates response", {
        status: res.status,
        ok: res.ok,
        headers: Object.fromEntries(res.headers.entries()),
        ratesCount: Array.isArray(data?.rates) ? data.rates.length : 0,
        validTo: data?.validTo || null,
      });
    } */

    if (!res.ok) {
      throw new Error(
        `Correo rates error: ${res.status} - ${JSON.stringify(data || {})}`
      );
    }

    setCachedRates(cacheKey, data);
    return data;
  } catch (error) {
    console.error("[correo] error en /rates", {
      message: error?.message,
      name: error?.name,
      cause: error?.cause,
      stack: error?.stack,
      url: `${requireEnv("CA_BASE_URL", BASE_URL)}/rates`,
      payload,
      abortLike: isAbortLikeError(error),
    });
    throw error;
  }
}

function pickBestRate(data, deliveredType = "D") {
  const rates = Array.isArray(data?.rates) ? data.rates : [];
  return rates.find((r) => r?.deliveredType === deliveredType) || rates[0] || null;
}

export async function quoteCorreoShipment({
  postalCodeDestination,
  deliveredType = "D",
  dimensions,
  forceOriginPostalCode,
}) {
  return await quoteCorreoRatesRaw({
    postalCodeDestination,
    deliveredType,
    dimensions,
    forceOriginPostalCode,
  });
}

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

export async function quoteCorreoOrder({
  postalCodeDestination,
  items,
  deliveredType = "D",
}) {
  if (!postalCodeDestination) {
    throw new Error("Missing postalCodeDestination");
  }

  if (!Array.isArray(items) || !items.length) {
    throw new Error("Carrito vacío");
  }

  const dimensions = computeCartDimensions(items);

  const data = await quoteCorreoRatesRaw({
    postalCodeDestination,
    deliveredType,
    dimensions,
  });

  const best = pickBestRate(data, deliveredType);

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
    validTo: data?.validTo || null,
  };
}