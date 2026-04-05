import { connectDB } from "@/lib/db";
import { ShippingZoneFallback } from "@/models/ShippingZoneFallback";
import { getRegionByProvinceCode } from "@/lib/shipping/fallbackLearning";

function normalizeDeliveredType(value) {
  return value === "S" ? "S" : "D";
}

function normalizeProvinceCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizePackageKey(value) {
  return String(value || "").trim();
}

function normalizeZone(value) {
  return String(value || "").trim();
}

function hasValidLearnedPrice(data) {
  if (!data) return false;

  const p75Price = Number(data?.p75Price);
  const medianPrice = Number(data?.medianPrice);

  const price =
    Number.isFinite(p75Price) && p75Price > 0 ? p75Price : medianPrice;

  return Number.isFinite(price) && price > 0;
}

function buildQuote(data, deliveredType) {
  const p75Price = Number(data?.p75Price);
  const medianPrice = Number(data?.medianPrice);

  const price =
    Number.isFinite(p75Price) && p75Price > 0 ? p75Price : medianPrice;

  const etaMin = Number(data?.etaMin);
  const etaMax = Number(data?.etaMax);

  const eta =
    Number.isFinite(etaMin) &&
    Number.isFinite(etaMax) &&
    etaMin > 0 &&
    etaMax > 0
      ? `${etaMin}-${etaMax} días`
      : "";

  return {
    carrier: "Correo Argentino",
    service: deliveredType === "S" ? "Sucursal" : "A domicilio",
    price: Math.round(price),
    eta,
    deliveredType,
    mode: "learned",
  };
}

export async function getLearnedRate({
  deliveredType = "D",
  provinceCode,
  packageKey,
  zone,
}) {
  await connectDB();

  const normalizedDeliveredType = normalizeDeliveredType(deliveredType);
  const normalizedProvinceCode = normalizeProvinceCode(provinceCode);
  const normalizedPackageKey = normalizePackageKey(packageKey);
  const normalizedZone = normalizeZone(zone);

  const region = getRegionByProvinceCode(normalizedProvinceCode);

  let data = null;

  // 1) exacto: región + packageKey + deliveredType
  if (region && normalizedPackageKey) {
    data = await ShippingZoneFallback.findOne({
      region,
      packageKey: normalizedPackageKey,
      deliveredType: normalizedDeliveredType,
    })
      .sort({ sampleCount: -1, updatedAt: -1 })
      .lean();

    if (hasValidLearnedPrice(data)) {
      return buildQuote(data, normalizedDeliveredType);
    }
  }

  // 2) intermedio: zone + packageKey + deliveredType
  if (normalizedZone && normalizedPackageKey) {
    data = await ShippingZoneFallback.findOne({
      zone: normalizedZone,
      packageKey: normalizedPackageKey,
      deliveredType: normalizedDeliveredType,
    })
      .sort({ sampleCount: -1, updatedAt: -1 })
      .lean();

    if (hasValidLearnedPrice(data)) {
      return buildQuote(data, normalizedDeliveredType);
    }
  }

  // 3) fallback por packageKey + deliveredType
  if (normalizedPackageKey) {
    data = await ShippingZoneFallback.findOne({
      packageKey: normalizedPackageKey,
      deliveredType: normalizedDeliveredType,
    })
      .sort({ sampleCount: -1, updatedAt: -1 })
      .lean();

    if (hasValidLearnedPrice(data)) {
      return buildQuote(data, normalizedDeliveredType);
    }
  }

  // 4) fallback global
  data = await ShippingZoneFallback.findOne({})
    .sort({ sampleCount: -1, updatedAt: -1 })
    .lean();

  if (hasValidLearnedPrice(data)) {
    return buildQuote(data, normalizedDeliveredType);
  }

  return null;
}