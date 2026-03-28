export const BOXES = {
  S: { code: "S", lengthCm: 25, widthCm: 20, heightCm: 15 },
  M: { code: "M", lengthCm: 35, widthCm: 30, heightCm: 20 },
  L: { code: "L", lengthCm: 45, widthCm: 35, heightCm: 30 },
};

export const PRODUCT_SHIPPING = {
  "contenedor-1100ml": {
    title: "Contenedor 1100ml",
    packedWeightKg: 0.45,
    defaultBox: "S",
  },
  "pack-esencial": {
    title: "Pack esencial",
    packedWeightKg: 0.95,
    defaultBox: "S",
  },
  "pack-familiar": {
    title: "Pack familiar",
    packedWeightKg: 1.9,
    defaultBox: "M",
  },
  "pack-completo": {
    title: "Pack completo",
    packedWeightKg: 3.8,
    defaultBox: "L",
  },
  "cubiertero-bambu-5-divisiones": {
    title: "Cubiertero 5 divisiones bambú",
    packedWeightKg: 1.4,
    defaultBox: "M",
  },
};

const BOX_ORDER = ["S", "M", "L"];

function maxBox(a, b) {
  return BOX_ORDER.indexOf(a) >= BOX_ORDER.indexOf(b) ? a : b;
}

export function buildPackageFromCart(items = []) {
  let totalWeightKg = 0;
  let selectedBox = "S";

  for (const item of items) {
    const cfg = PRODUCT_SHIPPING[item.slug];
    if (!cfg) {
      throw new Error(`Falta configuración de envío para el producto: ${item.slug}`);
    }

    const qty = Math.max(1, Number(item.qty || 1));
    totalWeightKg += cfg.packedWeightKg * qty;
    selectedBox = maxBox(selectedBox, cfg.defaultBox);
  }

  const slugs = items.map((x) => x.slug);

  const hasPackCompleto = slugs.includes("pack-completo");
  const hasCubiertero = slugs.includes("cubiertero-bambu-5-divisiones");

  if (hasPackCompleto && hasCubiertero) {
    selectedBox = "L";
    totalWeightKg += 0.2;
  }

  if (totalWeightKg > 4.5 && selectedBox === "M") {
    selectedBox = "L";
  }

  const box = BOXES[selectedBox];

  return {
    boxCode: selectedBox,
    weightKg: Number(totalWeightKg.toFixed(2)),
    lengthCm: box.lengthCm,
    widthCm: box.widthCm,
    heightCm: box.heightCm,
  };
}