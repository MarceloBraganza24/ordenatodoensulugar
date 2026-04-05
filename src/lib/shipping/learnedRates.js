// /lib/shipping/learnedRates.js

import { ShippingRate } from "@/models/ShippingRate";

function getZoneKey(postalCode, deliveredType) {
  const zip = String(postalCode || "").slice(0, 1); // primer dígito
  return `${deliveredType}-${zip}`;
}

export async function getLearnedRate({
  postalCodeDestination,
  deliveredType = "D",
}) {
  const zoneKey = getZoneKey(postalCodeDestination, deliveredType);

  const samples = await ShippingRate.find({ zoneKey })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  if (!samples.length) return null;

  const avgPrice =
    samples.reduce((acc, s) => acc + s.price, 0) / samples.length;

  return {
    carrier: "Envío estándar",
    service: "Tarifa estimada",
    price: Math.round(avgPrice),
    eta: samples[0]?.eta || "3 a 7 días",
    deliveredType,
    mode: "learned",
  };
}