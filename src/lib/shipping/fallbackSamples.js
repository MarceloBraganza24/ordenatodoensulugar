export const FALLBACK_SAMPLE_DESTINATIONS = [
  { region: "B_C", provinceCode: "C", city: "CABA", postalCode: "1121" },
  { region: "B_C", provinceCode: "B", city: "Bahía Blanca", postalCode: "8000" },
  { region: "B_C", provinceCode: "B", city: "La Plata", postalCode: "1900" },

  { region: "CENTRO", provinceCode: "S", city: "Santa Fe", postalCode: "3000" },
  { region: "CENTRO", provinceCode: "X", city: "Córdoba", postalCode: "5000" },
  { region: "CENTRO", provinceCode: "M", city: "Mendoza", postalCode: "5500" },
  { region: "CENTRO", provinceCode: "E", city: "Paraná", postalCode: "3100" },

  { region: "NOA_NEA", provinceCode: "T", city: "San Miguel de Tucumán", postalCode: "4000" },
  { region: "NOA_NEA", provinceCode: "A", city: "Salta", postalCode: "4400" },
  { region: "NOA_NEA", provinceCode: "W", city: "Corrientes", postalCode: "3400" },
  { region: "NOA_NEA", provinceCode: "N", city: "Posadas", postalCode: "3300" },

  { region: "PATAGONIA_NORTE", provinceCode: "Q", city: "Neuquén", postalCode: "8300" },
  { region: "PATAGONIA_NORTE", provinceCode: "R", city: "Bariloche", postalCode: "8400" },

  { region: "PATAGONIA_SUR", provinceCode: "U", city: "Comodoro Rivadavia", postalCode: "9000" },
  { region: "PATAGONIA_SUR", provinceCode: "Z", city: "Río Gallegos", postalCode: "9400" },
  { region: "PATAGONIA_SUR", provinceCode: "V", city: "Ushuaia", postalCode: "9410" },
];

export const FALLBACK_SAMPLE_PACKAGES = [
  {
    key: "small",
    label: "Paquete chico",
    dimensions: { weight: 500, height: 12, width: 20, length: 30 },
  },
  {
    key: "medium",
    label: "Paquete mediano",
    dimensions: { weight: 1200, height: 18, width: 30, length: 40 },
  },
];