import { connectDB } from "@/lib/db";
import { ShippingZoneFallback } from "@/models/ShippingZoneFallback";
import { getRegionByProvinceCode, getPackageKeyFromDimensions } from "@/lib/shipping/fallbackLearning";

export async function getLearnedFallbackShippingQuote({
  zip,
  originZip,
  provinceCode,
  dimensions,
  deliveredType = "D",
}) {
  const destination = String(zip || "").replace(/\D/g, "").slice(0, 4);
  const origin = String(originZip || "").replace(/\D/g, "").slice(0, 4);

  if (origin && destination && origin === destination) {
    return {
      carrier: "Envío gratis",
      service: "Zona local",
      price: 0,
      eta: "Coordinar entrega",
      deliveredType,
      mode: "flat",
    };
  }

  await connectDB();

  const region = getRegionByProvinceCode(provinceCode);
  const packageKey = getPackageKeyFromDimensions(dimensions);

  const learned = await ShippingZoneFallback.findOne({
    region,
    packageKey,
  }).lean();

  if (learned && learned.sampleCount >= 3) {
    return {
      carrier: "Envío estándar",
      service: "A domicilio",
      price: Number(learned.p75Price || learned.medianPrice || 0),
      eta:
        learned.etaMin && learned.etaMax
          ? `${learned.etaMin} a ${learned.etaMax} días hábiles`
          : "3 a 9 días hábiles",
      deliveredType,
      mode: "flat",
    };
  }

  return null;
}