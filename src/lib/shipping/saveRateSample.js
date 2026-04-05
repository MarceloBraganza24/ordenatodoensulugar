import { connectDB } from "@/lib/db";
import { ShippingRateSample } from "@/models/ShippingRateSample";
import { ShippingZoneFallback } from "@/models/ShippingZoneFallback";
import {
  getRegionByProvinceCode,
  getPackageKeyFromDimensions,
  median,
  percentile75,
} from "@/lib/shipping/fallbackLearning";

function normalizePostalCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

function normalizeProvinceCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeDeliveredType(value) {
  return value === "S" ? "S" : "D";
}

function normalizeDimensions(dimensions = {}) {
  return {
    weight: Math.round(Number(dimensions?.weight || 0)),
    height: Math.round(Number(dimensions?.height || 0)),
    width: Math.round(Number(dimensions?.width || 0)),
    length: Math.round(Number(dimensions?.length || 0)),
  };
}

function getZoneFromPostalCode(postalCode) {
  return normalizePostalCode(postalCode).charAt(0) || "";
}

function hasValidString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function saveCorreoRateSample({
  postalCodeOrigin,
  postalCodeDestination,
  provinceCode,
  deliveredType,
  dimensions,
  selectedRate,
  validTo,
}) {
  await connectDB();

  const normalizedProvinceCode = normalizeProvinceCode(provinceCode);
  const normalizedDeliveredType = normalizeDeliveredType(deliveredType);
  const normalizedOrigin = normalizePostalCode(postalCodeOrigin);
  const normalizedDestination = normalizePostalCode(postalCodeDestination);
  const normalizedDimensions = normalizeDimensions(dimensions);

  const region = getRegionByProvinceCode(normalizedProvinceCode);
  const packageKey = getPackageKeyFromDimensions(normalizedDimensions);
  const zone = getZoneFromPostalCode(normalizedDestination);

  const etaMin = Number(selectedRate?.deliveryTimeMin || 0);
  const etaMax = Number(selectedRate?.deliveryTimeMax || 0);
  const price = Number(selectedRate?.price || 0);

  if (!Number.isFinite(price) || price <= 0) {
    return;
  }

  if (!hasValidString(region) || !hasValidString(packageKey)) {
    return;
  }

  await ShippingRateSample.create({
    provider: "correo-argentino",
    postalCodeOrigin: normalizedOrigin,
    postalCodeDestination: normalizedDestination,
    provinceCode: normalizedProvinceCode,
    region,
    zone,
    deliveredType: normalizedDeliveredType,
    packageKey,
    dimensions: normalizedDimensions,
    service: selectedRate?.productName || selectedRate?.productType || "",
    price,
    etaMin: Number.isFinite(etaMin) && etaMin > 0 ? etaMin : 0,
    etaMax: Number.isFinite(etaMax) && etaMax > 0 ? etaMax : 0,
    validTo: validTo || null,
  });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const samples = await ShippingRateSample.find(
    {
      provider: "correo-argentino",
      region,
      packageKey,
      deliveredType: normalizedDeliveredType,
      createdAt: { $gte: since },
    },
    {
      price: 1,
      etaMin: 1,
      etaMax: 1,
      createdAt: 1,
    }
  )
    .sort({ createdAt: -1 })
    .lean();

  if (!samples.length) {
    return;
  }

  const prices = samples
    .map((x) => Number(x?.price || 0))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!prices.length) {
    return;
  }

  const etaMins = samples
    .map((x) => Number(x?.etaMin || 0))
    .filter((n) => Number.isFinite(n) && n > 0);

  const etaMaxs = samples
    .map((x) => Number(x?.etaMax || 0))
    .filter((n) => Number.isFinite(n) && n > 0);

  await ShippingZoneFallback.findOneAndUpdate(
    {
      region,
      packageKey,
      deliveredType: normalizedDeliveredType,
    },
    {
      provider: "correo-argentino",
      region,
      packageKey,
      deliveredType: normalizedDeliveredType,
      zone,
      sampleCount: samples.length,
      medianPrice: median(prices),
      p75Price: percentile75(prices),
      etaMin: etaMins.length ? Math.min(...etaMins) : null,
      etaMax: etaMaxs.length ? Math.max(...etaMaxs) : null,
      updatedAt: new Date(),
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}