import fs from "fs/promises";
import path from "path";

const projectRoot = process.cwd();

async function main() {
  const { quoteCorreoRatesRaw } = await import(
    path.join(projectRoot, "src/lib/correoArgentino.js")
  );

  const {
    FALLBACK_SAMPLE_DESTINATIONS,
    FALLBACK_SAMPLE_PACKAGES,
  } = await import(
    path.join(projectRoot, "src/lib/shipping/fallbackSamples.js")
  );

  const rows = [];

  for (const pkg of FALLBACK_SAMPLE_PACKAGES) {
    for (const dest of FALLBACK_SAMPLE_DESTINATIONS) {
      try {
        const data = await quoteCorreoRatesRaw({
          postalCodeDestination: dest.postalCode,
          deliveredType: "D",
          dimensions: pkg.dimensions,
        });

        const rates = Array.isArray(data?.rates) ? data.rates : [];
        const best =
          rates.find((r) => r?.deliveredType === "D") || rates[0] || null;

        if (!best) {
          rows.push({
            ok: false,
            packageKey: pkg.key,
            packageLabel: pkg.label,
            region: dest.region,
            provinceCode: dest.provinceCode,
            city: dest.city,
            postalCode: dest.postalCode,
            error: "Sin tarifas disponibles",
          });
          continue;
        }

        rows.push({
          ok: true,
          packageKey: pkg.key,
          packageLabel: pkg.label,
          region: dest.region,
          provinceCode: dest.provinceCode,
          city: dest.city,
          postalCode: dest.postalCode,
          service: best.productName || best.productType || "Correo Argentino",
          price: Number(best.price || 0),
          deliveryTimeMin: Number(best.deliveryTimeMin || 0),
          deliveryTimeMax: Number(best.deliveryTimeMax || 0),
          validTo: data?.validTo || null,
        });
      } catch (error) {
        rows.push({
          ok: false,
          packageKey: pkg.key,
          packageLabel: pkg.label,
          region: dest.region,
          provinceCode: dest.provinceCode,
          city: dest.city,
          postalCode: dest.postalCode,
          error: error?.message || "Error desconocido",
        });
      }
    }
  }

  const grouped = {};
  for (const row of rows) {
    if (!row.ok) continue;
    const key = `${row.packageKey}:${row.region}`;
    grouped[key] ||= [];
    grouped[key].push(row);
  }

  const fallbackTable = {};

  for (const [key, list] of Object.entries(grouped)) {
    const [packageKey, region] = key.split(":");

    const prices = list.map((x) => x.price).sort((a, b) => a - b);
    const minDays = list.map((x) => x.deliveryTimeMin).filter(Boolean);
    const maxDays = list.map((x) => x.deliveryTimeMax).filter(Boolean);

    const medianPrice =
      prices.length % 2 === 1
        ? prices[(prices.length - 1) / 2]
        : Math.round((prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2);

    fallbackTable[packageKey] ||= {};
    fallbackTable[packageKey][region] = {
      sampleCount: list.length,
      price: medianPrice,
      eta:
        minDays.length && maxDays.length
          ? `${Math.min(...minDays)} a ${Math.max(...maxDays)} días hábiles`
          : "",
      examples: list.map((x) => ({
        city: x.city,
        postalCode: x.postalCode,
        price: x.price,
      })),
    };
  }

  const output = {
    generatedAt: new Date().toISOString(),
    originPostalCode: process.env.CA_POSTAL_CODE_ORIGIN || "",
    rows,
    fallbackTable,
  };

  const outputPath = path.join(
    projectRoot,
    "src/lib/shipping/correoFallbackTable.generated.json"
  );

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log(`Tabla generada en: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});