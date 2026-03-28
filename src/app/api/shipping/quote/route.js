import { NextResponse } from "next/server";
import { quoteCorreoShipment } from "@/lib/correoArgentino";

export const runtime = "nodejs";

const ORIGIN_POSTAL_CODE = String(process.env.CA_POSTAL_CODE_ORIGIN || "").trim();

function normalizeZip(v) {
  return String(v || "").replace(/\D/g, "").slice(0, 4);
}

function isSamePostalCode(origin, destination) {
  return normalizeZip(origin) === normalizeZip(destination);
}

function getFallbackShippingQuote({ postalCodeDestination, provinceCode, deliveredType }) {
  const destination = normalizeZip(postalCodeDestination);
  const province = String(provinceCode || "").trim().toUpperCase();

  // mismo CP => gratis
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

  // Buenos Aires + CABA
  if (province === "B" || province === "C") {
    return {
      carrier: "Envío estándar",
      service: "A domicilio",
      price: 6900,
      eta: "3 a 7 días hábiles",
      deliveredType: deliveredType || "D",
      mode: "flat",
    };
  }

  // Patagonia / lejanas
  if (["R", "Q", "U", "Z", "V"].includes(province)) {
    return {
      carrier: "Envío estándar",
      service: "A domicilio",
      price: 11900,
      eta: "4 a 10 días hábiles",
      deliveredType: deliveredType || "D",
      mode: "flat",
    };
  }

  // resto país
  return {
    carrier: "Envío estándar",
    service: "A domicilio",
    price: 8900,
    eta: "3 a 9 días hábiles",
    deliveredType: deliveredType || "D",
    mode: "flat",
  };
}

function pickPackaging(items) {
  const totalQty = items.reduce((acc, it) => acc + Number(it.qty || 0), 0);
  const totalWeight = items.reduce(
    (acc, it) => acc + Number(it.weightGrams || 0) * Number(it.qty || 0),
    0
  );

  if (totalQty <= 2) {
    return {
      weight: Math.max(totalWeight, 500),
      height: 12,
      width: 20,
      length: 30,
    };
  }

  if (totalQty <= 6) {
    return {
      weight: Math.max(totalWeight, 1200),
      height: 18,
      width: 30,
      length: 40,
    };
  }

  return {
    weight: Math.max(totalWeight, 2500),
    height: 25,
    width: 40,
    length: 50,
  };
}

export async function POST(req) {
  try {
    const body = await req.json();

    const postalCode = String(body?.postalCode || "").trim();
    const deliveredType =
      body?.deliveredType === "D" || body?.deliveredType === "S"
        ? body.deliveredType
        : "D";

    const items = Array.isArray(body?.items) ? body.items : [];
    const destinationProvince = String(body?.destination?.province || "")
      .trim()
      .toUpperCase();

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

    console.log("QUOTE ROUTE body:", JSON.stringify(body, null, 2));
    console.log("QUOTE ROUTE parsed:", {
      postalCode,
      deliveredType,
      items,
      dimensions,
      destinationProvince,
    });

    // 1) intentar con Correo Argentino
    try {
      const correoData = await quoteCorreoShipment({
        postalCodeDestination: postalCode,
        deliveredType,
        dimensions,
      });

      const rates = Array.isArray(correoData?.rates) ? correoData.rates : [];
      const selectedRate =
        deliveredType
          ? rates.find((r) => r.deliveredType === deliveredType) || rates[0]
          : rates[0];

      if (selectedRate && Number.isFinite(Number(selectedRate.price))) {
        return NextResponse.json({
          ok: true,
          provider: "correo_argentino",
          quote: {
            carrier: "Correo Argentino",
            service: selectedRate.productName || selectedRate.productType || "A domicilio",
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
          fallbackUsed: false,
        });
      }

      console.warn("Correo no devolvió tarifas usables. Se aplica fallback.", {
        postalCode,
        deliveredType,
        rates,
      });
    } catch (correoError) {
      console.warn("Error cotizando con Correo. Se aplica fallback.", {
        message: correoError?.message,
      });
    }

    // 2) fallback interno POR PROVINCIA
    const fallback = getFallbackShippingQuote({
      postalCodeDestination: postalCode,
      provinceCode: destinationProvince,
      deliveredType,
    });

    return NextResponse.json({
      ok: true,
      provider: "fallback",
      quote: fallback,
      deliveredTypeUsed: deliveredType,
      postalCodeDestinationUsed: postalCode,
      dimensionsUsed: dimensions,
      fallbackUsed: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Error al cotizar envío",
      },
      { status: 500 }
    );
  }
}

/* import { NextResponse } from "next/server";
import { quoteCorreoShipment } from "@/lib/correoArgentino";

export const runtime = "nodejs";

const ORIGIN_POSTAL_CODE = String(process.env.CA_POSTAL_CODE_ORIGIN || "").trim();

// tarifa base
const DEFAULT_SHIPPING_PRICE = 6900;

// zonas más lejanas
const FAR_ZONE_PRICES = [
  { prefix: "8", price: 8900 }, // ejemplo Bahía / sur Bs As
  { prefix: "9", price: 11900 }, // Patagonia u otras zonas lejanas
];

function isSamePostalCode(origin, destination) {
  return String(origin || "").trim() === String(destination || "").trim();
}

function getFallbackShippingPrice(postalCodeDestination) {
  const destination = String(postalCodeDestination || "").trim();

  if (!destination) {
    return {
      provider: "fallback",
      price: DEFAULT_SHIPPING_PRICE,
      reason: "missing_destination_cp",
    };
  }

  if (ORIGIN_POSTAL_CODE && isSamePostalCode(ORIGIN_POSTAL_CODE, destination)) {
    return {
      provider: "fallback",
      price: 0,
      reason: "same_postal_code",
    };
  }

  const farZone = FAR_ZONE_PRICES.find((zone) => destination.startsWith(zone.prefix));

  if (farZone) {
    return {
      provider: "fallback",
      price: farZone.price,
      reason: `far_zone_${farZone.prefix}`,
    };
  }

  return {
    provider: "fallback",
    price: DEFAULT_SHIPPING_PRICE,
    reason: "default_zone",
  };
}

function pickPackaging(items) {
  const totalQty = items.reduce((acc, it) => acc + Number(it.qty || 0), 0);
  const totalWeight = items.reduce(
    (acc, it) => acc + Number(it.weightGrams || 0) * Number(it.qty || 0),
    0
  );

  if (totalQty <= 2) {
    return {
      weight: Math.max(totalWeight, 500),
      height: 12,
      width: 20,
      length: 30,
    };
  }

  if (totalQty <= 6) {
    return {
      weight: Math.max(totalWeight, 1200),
      height: 18,
      width: 30,
      length: 40,
    };
  }

  return {
    weight: Math.max(totalWeight, 2500),
    height: 25,
    width: 40,
    length: 50,
  };
}

export async function POST(req) {
  try {
    const body = await req.json();

    const postalCode = String(body?.postalCode || "").trim();
    const deliveredType =
      body?.deliveredType === "D" || body?.deliveredType === "S"
        ? body.deliveredType
        : undefined;

    const items = Array.isArray(body?.items) ? body.items : [];

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

    console.log("QUOTE ROUTE body:", JSON.stringify(body, null, 2));
    console.log("QUOTE ROUTE parsed:", {
      postalCode,
      deliveredType,
      items,
      dimensions,
    });

    // 1) intentar con Correo Argentino
    try {
      const correoData = await quoteCorreoShipment({
        postalCodeDestination: postalCode,
        deliveredType,
        dimensions,
      });

      const rates = Array.isArray(correoData?.rates) ? correoData.rates : [];
      const selectedRate =
        deliveredType
          ? rates.find((r) => r.deliveredType === deliveredType) || rates[0]
          : rates[0];

      if (selectedRate && Number.isFinite(Number(selectedRate.price))) {
        
        return NextResponse.json({
          ok: true,
          provider: "correo_argentino",

          quote: {
            carrier: "Correo Argentino",
            service: selectedRate.productName || "Envío estándar",
            price: Number(selectedRate.price),
            eta:
              selectedRate.deliveryTimeMin && selectedRate.deliveryTimeMax
                ? `${selectedRate.deliveryTimeMin}-${selectedRate.deliveryTimeMax} días`
                : "",
            deliveredType: selectedRate.deliveredType,
            mode: "correo",
          },

          deliveredTypeUsed: deliveredType ?? null,
          postalCodeDestinationUsed: postalCode,
          dimensionsUsed: dimensions,
          fallbackUsed: false,
        });
        
      }

      console.warn("Correo no devolvió tarifas usables. Se aplica fallback.", {
        postalCode,
        deliveredType,
        rates,
      });
    } catch (correoError) {
      console.warn("Error cotizando con Correo. Se aplica fallback.", {
        message: correoError?.message,
      });
    }

    // 2) fallback interno
    const fallback = getFallbackShippingPrice(postalCode);

    return NextResponse.json({
      ok: true,
      provider: fallback.provider,

      quote: {
        carrier: "Envío estándar",
        service: "A domicilio",
        price: fallback.price,
        eta: "3 a 7 días hábiles",
        deliveredType: deliveredType ?? "D",
        mode: "flat",
      },

      deliveredTypeUsed: deliveredType ?? null,
      postalCodeDestinationUsed: postalCode,
      dimensionsUsed: dimensions,
      fallbackUsed: true,
      fallbackReason: fallback.reason,
    });
    
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Error al cotizar envío",
      },
      { status: 500 }
    );
  }
} */