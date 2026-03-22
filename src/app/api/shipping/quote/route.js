import { NextResponse } from "next/server";
import { quoteCorreoShipment } from "@/lib/correoArgentino";

function pickPackaging(items) {
  const totalQty = items.reduce((acc, it) => acc + Number(it.qty || 0), 0);
  const totalWeight = items.reduce(
    (acc, it) => acc + Number(it.weightGrams || 0) * Number(it.qty || 0),
    0
  );

  // ejemplo simple
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
    const deliveryType = body?.deliveryType === "S" ? "S" : "D";
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

    const data = await quoteCorreoShipment({
      postalCodeDestination: postalCode,
      deliveryType,
      dimensions,
    });

    const selectedRate = data?.rates?.find((r) => r.deliveredType === deliveryType);

    if (!selectedRate) {
      return NextResponse.json(
        { ok: false, error: "No se obtuvo tarifa de Correo Argentino" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      shippingPrice: selectedRate.price,
      productType: selectedRate.productType,
      productName: selectedRate.productName,
      validTo: data?.validTo || null,
      rawRates: data?.rates || [],
      dimensionsUsed: dimensions,
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