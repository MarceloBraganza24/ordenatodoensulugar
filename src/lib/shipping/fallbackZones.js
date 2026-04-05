import fallbackData from "@/lib/shipping/correoFallbackTable.generated.json";

function normalizeZip(v) {
  return String(v || "").replace(/\D/g, "").slice(0, 4);
}

function getRegionByProvinceCode(provinceCode) {
  const p = String(provinceCode || "").toUpperCase().trim();

  if (p === "B" || p === "C") return "B_C";
  if (["Q", "R"].includes(p)) return "PATAGONIA_NORTE";
  if (["U", "Z", "V"].includes(p)) return "PATAGONIA_SUR";
  if (["A", "H", "J", "K", "N", "P", "T", "W", "Y"].includes(p)) return "NOA_NEA";
  return "CENTRO";
}

export function getFallbackPackageKeyFromDimensions(dimensions = {}) {
  const weight = Number(dimensions.weight || 0);
  return weight <= 700 ? "small" : "medium";
}

export function getFallbackShippingQuoteFromTable({
  zip,
  originZip,
  provinceCode,
  dimensions,
}) {
  const destinationZip = normalizeZip(zip);
  const origin = normalizeZip(originZip);

  if (origin && destinationZip && origin === destinationZip) {
    return {
      provider: "local",
      service: "Envío gratis zona local",
      eta: "Coordinar entrega",
      price: 0,
      deliveredType: "D",
      validTo: null,
    };
  }

  const packageKey = getFallbackPackageKeyFromDimensions(dimensions);
  const region = getRegionByProvinceCode(provinceCode);

  const row = fallbackData?.fallbackTable?.[packageKey]?.[region];

  if (!row) {
    return {
      provider: "zones",
      service: "Tarifa fija",
      eta: "3 a 9 días hábiles",
      price: 8900,
      deliveredType: "D",
      validTo: null,
    };
  }

  return {
    provider: "zones",
    service: `Tarifa fija ${region}`,
    eta: row.eta || "",
    price: Number(row.price || 0),
    deliveredType: "D",
    validTo: null,
  };
}