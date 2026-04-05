import { NextResponse } from "next/server";
import { quoteCorreoShipment } from "@/lib/correoArgentino";
import { saveCorreoRateSample } from "@/lib/shipping/saveRateSample";
import { getLearnedRate } from "@/lib/shipping/getLearnedRate";
import { getPackageKeyFromDimensions } from "@/lib/shipping/fallbackLearning";

export const runtime = "nodejs";

const ORIGIN_POSTAL_CODE = String(
  process.env.CA_POSTAL_CODE_ORIGIN || ""
).trim();

const IS_DEV = process.env.NODE_ENV !== "production";

/* ======================================================
   CACHE GLOBAL DE COTIZACIÓN
====================================================== */

let quoteCache = new Map();
const QUOTE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function clearExpiredQuoteCache() {
  const now = Date.now();

  for (const [key, entry] of quoteCache.entries()) {
    if (!entry || now > entry.expiresAt) {
      quoteCache.delete(key);
    }
  }
}

function buildQuoteCacheKey({ postalCode, deliveredType, packageKey }) {
  return JSON.stringify({
    postalCode: normalizeZip(postalCode),
    deliveredType: deliveredType || "D",
    packageKey: String(packageKey || "").trim(),
  });
}

function getCachedQuote(cacheKey) {
  const entry = quoteCache.get(cacheKey);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    quoteCache.delete(cacheKey);
    return null;
  }

  return entry.data;
}

function setCachedQuote(cacheKey, data) {
  quoteCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + QUOTE_CACHE_TTL_MS,
  });
}

/* ======================================================
   HELPERS
====================================================== */

function normalizeZip(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

function isSamePostalCode(origin, destination) {
  return normalizeZip(origin) === normalizeZip(destination);
}

/* ======================================================
   FALLBACK POR ZONAS (CP REAL)
====================================================== */

function getFallbackShippingQuote({ postalCodeDestination, deliveredType }) {
  const destination = normalizeZip(postalCodeDestination);

  if (
    ORIGIN_POSTAL_CODE &&
    destination &&
    isSamePostalCode(ORIGIN_POSTAL_CODE, destination)
  ) {
    return {
      carrier: "Envío gratis",
      service: "Zona local",
      price: 0,
      eta: "Coordinar entrega",
      deliveredType: deliveredType || "D",
      mode: "flat",
    };
  }

  const prefix = destination.charAt(0);

  if (["1", "2", "3"].includes(prefix)) {
    return {
      carrier: "Envío estándar",
      service: "A domicilio",
      price: 6900,
      eta: "2 a 5 días hábiles",
      deliveredType: deliveredType || "D",
      mode: "flat",
    };
  }

  if (["4", "5", "6", "7", "8"].includes(prefix)) {
    return {
      carrier: "Envío estándar",
      service: "A domicilio",
      price: 7900,
      eta: "2 a 6 días hábiles",
      deliveredType: deliveredType || "D",
      mode: "flat",
    };
  }

  if (["9"].includes(prefix)) {
    return {
      carrier: "Envío estándar",
      service: "A domicilio",
      price: 11900,
      eta: "4 a 10 días hábiles",
      deliveredType: deliveredType || "D",
      mode: "flat",
    };
  }

  return {
    carrier: "Envío estándar",
    service: "A domicilio",
    price: 8900,
    eta: "3 a 9 días hábiles",
    deliveredType: deliveredType || "D",
    mode: "flat",
  };
}

/* ======================================================
   PACKAGING
====================================================== */

function pickPackaging(items) {
  const normalizedItems = Array.isArray(items) ? items : [];

  const qtyBySlug = normalizedItems.reduce((acc, item) => {
    const slug = String(item.slug || "").trim();
    const qty = Number(item.qty || 0);

    if (!slug || qty <= 0) return acc;

    acc[slug] = (acc[slug] || 0) + qty;
    return acc;
  }, {});

  const esencialQty = qtyBySlug["pack-esencial"] || 0;
  const familiarQty = qtyBySlug["pack-familiar"] || 0;
  const completoQty = qtyBySlug["pack-completo"] || 0;
  const cubierteroQty = qtyBySlug["cubiertero-bambu"] || 0;

  const totalMainPacks = esencialQty + familiarQty + completoQty;

  if (totalMainPacks === 0 && cubierteroQty === 0) {
    return {
      weight: 500,
      height: 12,
      width: 20,
      length: 30,
    };
  }

  if (
    esencialQty === 1 &&
    familiarQty === 0 &&
    completoQty === 0 &&
    cubierteroQty === 0
  ) {
    return {
      weight: 435 + 180,
      height: 15,
      width: 20,
      length: 20,
    };
  }

  if (
    esencialQty === 1 &&
    familiarQty === 0 &&
    completoQty === 0 &&
    cubierteroQty === 1
  ) {
    return {
      weight: 1335 + 300,
      height: 25,
      width: 35,
      length: 45,
    };
  }

  if (
    esencialQty === 0 &&
    familiarQty === 1 &&
    completoQty === 0 &&
    cubierteroQty === 0
  ) {
    return {
      weight: 955 + 260,
      height: 25,
      width: 20,
      length: 25,
    };
  }

  if (
    esencialQty === 0 &&
    familiarQty === 1 &&
    completoQty === 0 &&
    cubierteroQty === 1
  ) {
    return {
      weight: 1855 + 380,
      height: 35,
      width: 35,
      length: 45,
    };
  }

  if (
    esencialQty === 0 &&
    familiarQty === 0 &&
    completoQty === 1 &&
    cubierteroQty === 0
  ) {
    return {
      weight: 2410 + 420,
      height: 25,
      width: 35,
      length: 40,
    };
  }

  if (
    esencialQty === 0 &&
    familiarQty === 0 &&
    completoQty === 1 &&
    cubierteroQty === 1
  ) {
    return {
      weight: 3310 + 500,
      height: 35,
      width: 35,
      length: 45,
    };
  }

  if (totalMainPacks === 0 && cubierteroQty >= 1) {
    return {
      weight: 900 + 220 * cubierteroQty,
      height: 10,
      width: 35,
      length: 45,
    };
  }

  const productsWeight =
    esencialQty * 435 +
    familiarQty * 955 +
    completoQty * 2410 +
    cubierteroQty * 900;

  const estimatedBoxesWeight =
    esencialQty * 180 +
    familiarQty * 260 +
    completoQty * 420 +
    cubierteroQty * 220;

  const totalWeight = productsWeight + estimatedBoxesWeight;

  let length = 20;
  let width = 20;
  let height = 15;

  if (completoQty > 0) {
    length = 40;
    width = 35;
    height = 25;
  } else if (familiarQty > 0) {
    length = 25;
    width = 20;
    height = 25;
  } else if (esencialQty > 0) {
    length = 20;
    width = 20;
    height = 15;
  }

  if (cubierteroQty > 0 && totalMainPacks > 0) {
    length = 45;
    width = 35;
    height = 35;
  }

  if (totalMainPacks >= 2) {
    height += 10;
  }

  if (totalMainPacks >= 3) {
    height += 10;
    length = Math.max(length, 45);
    width = Math.max(width, 35);
  }

  return {
    weight: Math.round(totalWeight),
    height: Math.round(height),
    width: Math.round(width),
    length: Math.round(length),
  };
}

/* ======================================================
   ROUTE
====================================================== */

export async function POST(req) {
  const startedAt = Date.now();

  try {
    const body = await req.json();

    const postalCode = String(body?.postalCode || "").trim();
    const deliveredType =
      body?.deliveredType === "D" || body?.deliveredType === "S"
        ? body.deliveredType
        : "D";

    const items = Array.isArray(body?.items) ? body.items : [];

    const destinationProvince = String(
      body?.destination?.province || ""
    ).trim().toUpperCase();

    if (!postalCode) {
      return NextResponse.json(
        { ok: false, error: "Falta código postal destino" },
        { status: 400 }
      );
    }

    if (!items.length) {
      return NextResponse.json(
        { ok: false, error: "No hay items para cotizar" },
        { status: 400 }
      );
    }

    const dimensions = pickPackaging(items);
    const packageKey = getPackageKeyFromDimensions(dimensions);

    clearExpiredQuoteCache();

    const cacheKey = buildQuoteCacheKey({
      postalCode,
      deliveredType,
      packageKey,
    });

    const cached = getCachedQuote(cacheKey);

    if (cached) {
      if (IS_DEV) {
        console.log("[quote] cache HIT", {
          cacheKey,
          provider: cached?.provider,
          durationMs: Date.now() - startedAt,
        });
      }

      return NextResponse.json({
        ok: true,
        ...cached,
        cache: true,
      });
    }

    try {
      const correoData = await quoteCorreoShipment({
        postalCodeDestination: postalCode,
        deliveredType,
        dimensions,
      });

      const rates = Array.isArray(correoData?.rates) ? correoData.rates : [];

      const selectedRate =
        rates.find((r) => r?.deliveredType === deliveredType) || rates[0] || null;

      if (selectedRate && Number.isFinite(Number(selectedRate.price))) {
        saveCorreoRateSample({
          postalCodeOrigin: ORIGIN_POSTAL_CODE,
          postalCodeDestination: postalCode,
          provinceCode: destinationProvince,
          deliveredType,
          dimensions,
          selectedRate,
          validTo: correoData?.validTo || null,
        }).catch((err) => {
          console.warn(
            "[shipping] no se pudo guardar sample de Correo",
            err?.message || err
          );
        });

        const response = {
          provider: "correo_argentino",
          quote: {
            carrier: "Correo Argentino",
            service:
              selectedRate.productName ||
              selectedRate.productType ||
              "A domicilio",
            price: Number(selectedRate.price),
            eta:
              selectedRate.deliveryTimeMin && selectedRate.deliveryTimeMax
                ? `${selectedRate.deliveryTimeMin}-${selectedRate.deliveryTimeMax} días`
                : "",
            deliveredType: selectedRate.deliveredType || deliveredType,
            mode: "correo",
          },
          deliveredTypeUsed: deliveredType,
          postalCodeDestinationUsed: postalCode,
          dimensionsUsed: dimensions,
          packageKeyUsed: packageKey,
          fallbackUsed: false,
        };

        setCachedQuote(cacheKey, response);

        if (IS_DEV) {
          console.log("[quote] usando tarifa de Correo", {
            postalCode,
            deliveredType,
            packageKey,
            price: Number(selectedRate.price),
            durationMs: Date.now() - startedAt,
          });
        }

        return NextResponse.json({
          ok: true,
          ...response,
          cache: false,
        });
      }

      if (IS_DEV) {
        console.warn("[quote] Correo sin tarifas válidas → learned/fallback", {
          postalCode,
          deliveredType,
          packageKey,
        });
      }
    } catch (error) {
      console.warn("[quote] Error Correo → learned/fallback", {
        message: error?.message,
        postalCode,
        deliveredType,
        packageKey,
      });
    }

    let learnedRate = null;

    try {
      learnedRate = await getLearnedRate({
        deliveredType,
        packageKey,
        provinceCode: destinationProvince,
        zone: normalizeZip(postalCode).charAt(0),
      });
    } catch (err) {
      console.error("[quote] error en getLearnedRate", {
        message: err?.message,
        stack: err?.stack,
      });
    }

    if (learnedRate) {
      const response = {
        provider: "learned",
        quote: learnedRate,
        deliveredTypeUsed: deliveredType,
        postalCodeDestinationUsed: postalCode,
        dimensionsUsed: dimensions,
        packageKeyUsed: packageKey,
        fallbackUsed: true,
      };

      setCachedQuote(cacheKey, response);

      if (IS_DEV) {
        console.log("[quote] usando tarifa aprendida", {
          postalCode,
          deliveredType,
          packageKey,
          price: learnedRate?.price,
          durationMs: Date.now() - startedAt,
        });
      }

      return NextResponse.json({
        ok: true,
        ...response,
        cache: false,
      });
    }

    const fallback = getFallbackShippingQuote({
      postalCodeDestination: postalCode,
      deliveredType,
    });

    const response = {
      provider: "fallback",
      quote: fallback,
      deliveredTypeUsed: deliveredType,
      postalCodeDestinationUsed: postalCode,
      dimensionsUsed: dimensions,
      packageKeyUsed: packageKey,
      fallbackUsed: true,
    };

    setCachedQuote(cacheKey, response);

    if (IS_DEV) {
      console.log("[quote] usando fallback zonal", {
        postalCode,
        deliveredType,
        packageKey,
        price: fallback?.price,
        durationMs: Date.now() - startedAt,
      });
    }

    return NextResponse.json({
      ok: true,
      ...response,
      cache: false,
    });
  } catch (error) {
    console.error("[shipping/quote] ERROR FATAL", {
      message: error?.message,
      stack: error?.stack,
      cause: error?.cause,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Error al cotizar envío",
      },
      { status: 500 }
    );
  }
}