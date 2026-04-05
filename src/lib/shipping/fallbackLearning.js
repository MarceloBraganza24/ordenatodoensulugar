export function normalizeZip(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

export function getZoneFromPostalCode(postalCode) {
  return normalizeZip(postalCode).charAt(0) || "";
}

export function getRegionByProvinceCode(provinceCode) {
  const p = String(provinceCode || "").trim().toUpperCase();

  if (p === "B" || p === "C") return "B_C";
  if (["Q", "R"].includes(p)) return "PATAGONIA_NORTE";
  if (["U", "V", "Z"].includes(p)) return "PATAGONIA_SUR";
  if (["A", "H", "J", "K", "N", "P", "T", "W", "Y"].includes(p)) {
    return "NOA_NEA";
  }

  return "CENTRO";
}

export function getPackageKeyFromDimensions(dimensions = {}) {
  const weight = Math.round(Number(dimensions?.weight || 0));
  const height = Math.round(Number(dimensions?.height || 0));
  const width = Math.round(Number(dimensions?.width || 0));
  const length = Math.round(Number(dimensions?.length || 0));

  // fallback seguro si viene algo raro
  if (weight <= 0 && height <= 0 && width <= 0 && length <= 0) {
    return "small";
  }

  // criterio principal por peso
  if (weight <= 700) return "small";
  if (weight <= 1600) return "medium";

  return "large";
}

function normalizeNumericArray(values) {
  return (Array.isArray(values) ? values : [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function median(values) {
  const arr = normalizeNumericArray(values);

  if (!arr.length) return 0;

  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }

  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function percentile75(values) {
  const arr = normalizeNumericArray(values);

  if (!arr.length) return 0;
  if (arr.length === 1) return arr[0];

  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.75) - 1;

  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}