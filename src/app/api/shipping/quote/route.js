import { NextResponse } from "next/server";
import { Buffer } from "buffer";

export const runtime = "nodejs";

const CA_BASE_URL =
  process.env.CA_BASE_URL || "https://apitest.correoargentino.com.ar/micorreo/v1";

const CA_USER = process.env.CA_USER;
const CA_PASSWORD = process.env.CA_PASSWORD;
const CA_CUSTOMER_ID = process.env.CA_CUSTOMER_ID;
const CA_POSTAL_ORIGIN = process.env.CA_POSTAL_ORIGIN;
const CA_DELIVERED_TYPE_DEFAULT = process.env.CA_DELIVERED_TYPE || "D";

let tokenCache = { token: null, validToMs: 0 };

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function parseValidToToMs(validTo) {
  // validTo puede venir como ISO string o timestamp (depende del servicio)
  if (!validTo) return 0;
  const d = new Date(validTo);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeProvinceCodeOrName(v) {
  const s = String(v || "").trim().toLowerCase();

  // Si ya viene código (1 letra), lo devolvemos en upper
  if (s.length === 1) return s.toUpperCase();

  // Mapeo básico por nombre
  if (s === "caba" || s.includes("capital")) return "C";
  if (s.includes("buenos aires")) return "B";
  if (s.includes("río negro") || s.includes("rio negro")) return "R";
  if (s.includes("neuquén") || s.includes("neuquen")) return "Q";
  if (s.includes("chubut")) return "U";
  if (s.includes("santa cruz")) return "Z";
  if (s.includes("tierra del fuego")) return "V";

  // (si querés, completamos el resto después)
  return ""; // desconocida
}

function flatQuoteByProvince(provinceAny) {
  const code = normalizeProvinceCodeOrName(provinceAny);

  // Buenos Aires + CABA
  if (code === "B" || code === "C") {
    return {
      carrier: "Envío estándar",
      service: "A domicilio (tarifa fija)",
      price: 6900,
      eta: "3 a 7 días hábiles",
      deliveredType: "D",
      mode: "flat",
    };
  }

  // Patagonia + TDF
  const patagonia = ["R", "Q", "U", "Z", "V"]; // RN, NQN, CHU, SC, TDF
  if (patagonia.includes(code)) {
    return {
      carrier: "Envío estándar",
      service: "A domicilio (tarifa fija)",
      price: 11900,
      eta: "4 a 10 días hábiles",
      deliveredType: "D",
      mode: "flat",
    };
  }

  // Resto
  return {
    carrier: "Envío estándar",
    service: "A domicilio (tarifa fija)",
    price: 8900,
    eta: "3 a 9 días hábiles",
    deliveredType: "D",
    mode: "flat",
  };
}

async function getToken() {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.validToMs - 30_000) {
    return tokenCache.token;
  }

  requireEnv("CA_USER", CA_USER);
  requireEnv("CA_PASSWORD", CA_PASSWORD);

  const basic = Buffer.from(`${CA_USER}:${CA_PASSWORD}`).toString("base64");

  const r = await fetch(`${CA_BASE_URL}/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    cache: "no-store",
  });

  const txt = await r.text().catch(() => "");
  if (!r.ok) {
    throw new Error(`Correo /token failed: ${r.status} ${txt}`);
  }

  let data = {};
  try {
    data = txt ? JSON.parse(txt) : {};
  } catch {
    throw new Error(`Correo /token invalid JSON: ${txt}`);
  }

  if (!data?.token) {
    throw new Error(`Correo /token missing token field: ${JSON.stringify(data)}`);
  }

  tokenCache.token = data.token;

  // si viene validTo lo usamos; sino 10 min
  const validToMs = parseValidToToMs(data.validTo);
  tokenCache.validToMs = validToMs || Date.now() + 10 * 60 * 1000;

  return tokenCache.token;
}

const PRODUCT_DIMENSIONS = {
  "organizador-acrilico-1100": { weight: 600, height: 12, width: 12, length: 20 },
};

function computeCartDimensions(items) {
  let totalWeight = 0;
  let maxH = 0, maxW = 0, maxL = 0;

  for (const it of items) {
    const d = PRODUCT_DIMENSIONS[it.slug];
    const qty = Number(it.qty || 0);
    if (!d || qty <= 0) continue;

    totalWeight += d.weight * qty;
    maxH = Math.max(maxH, d.height);
    maxW = Math.max(maxW, d.width);
    maxL = Math.max(maxL, d.length);
  }

  if (totalWeight <= 0) {
    totalWeight = 1500;
    maxH = 10; maxW = 20; maxL = 30;
  }

  return {
    weight: Math.round(totalWeight),
    height: Math.round(maxH),
    width: Math.round(maxW),
    length: Math.round(maxL),
  };
}

export async function POST(req) {
  try {
    // ✅ si no hay credenciales todavía: responder 200 con ok:false (sin romper UI)
    const missing =
      !process.env.CA_USER ||
      !process.env.CA_PASSWORD ||
      !process.env.CA_CUSTOMER_ID ||
      !process.env.CA_POSTAL_ORIGIN;

    const body = await req.json().catch(() => ({}));
    const postalCode = String(body?.postalCode || "").replace(/\D/g, "").slice(0, 8);
    const items = Array.isArray(body?.items) ? body.items : [];
    const deliveredType = body?.deliveredType || CA_DELIVERED_TYPE_DEFAULT;
    const provinceCode = body?.destination?.province || ""; // 👈 viene del front
    
    if (missing) {
      const quote = flatQuoteByProvince(provinceCode);
      return NextResponse.json({ ok: true, quote });
    }

    if (!postalCode || postalCode.length < 4) {
      return NextResponse.json({ ok: false, error: "CP inválido" }, { status: 400 });
    }
    if (!items.length) {
      return NextResponse.json({ ok: false, error: "Carrito vacío" }, { status: 400 });
    }
    if (!provinceCode) {
      return NextResponse.json({ ok: false, error: "Seleccioná provincia para cotizar." }, { status: 400 });
    }

    const dimensions = computeCartDimensions(items);
    const token = await getToken();

    const ratesReq = {
      customerId: CA_CUSTOMER_ID,
      postalCodeOrigin: CA_POSTAL_ORIGIN,
      postalCodeDestination: postalCode,
      deliveredType,
      dimensions,
    };

    const r = await fetch(`${CA_BASE_URL}/rates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ratesReq),
      cache: "no-store",
    });

    const txt = await r.text().catch(() => "");
    let data = {};
    try {
      data = txt ? JSON.parse(txt) : {};
    } catch {
      return NextResponse.json(
        { ok: false, error: "Correo Argentino: respuesta inválida", detail: txt },
        { status: 502 }
      );
    }

    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: "Correo Argentino: error al cotizar", detail: data },
        { status: 502 }
      );
    }

    const best = data?.rates?.[0];
    if (!best) {
      return NextResponse.json({ ok: false, error: "Sin tarifas disponibles", detail: data }, { status: 404 });
    }

    const quote = {
      carrier: "Correo Argentino",
      service: best.productName || best.productType || "Servicio",
      price: Number(best.price || 0),
      eta:
        best.deliveryTimeMin && best.deliveryTimeMax
          ? `${best.deliveryTimeMin}-${best.deliveryTimeMax} días`
          : "A confirmar",
      deliveredType: best.deliveredType,
      raw: best,
      validTo: data.validTo,
    };

    return NextResponse.json({ ok: true, quote });
  } catch (e) {
    console.error("[/api/shipping/quote] ERROR:", e);

    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Error inesperado",
        // En prod podés sacarlo si querés
        detail: process.env.NODE_ENV === "development" ? String(e?.stack || "") : undefined,
      },
      { status: 500 }
    );
  }
}