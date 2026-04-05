import mongoose from "mongoose";

const ShippingRateSampleSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "correo-argentino", trim: true },

    postalCodeOrigin: { type: String, required: true, trim: true },
    postalCodeDestination: { type: String, required: true, trim: true },

    provinceCode: { type: String, required: true, trim: true },
    region: { type: String, required: true, trim: true },

    // opcional pero útil para análisis y fallback futuro
    zone: { type: String, default: "", trim: true },

    deliveredType: {
      type: String,
      default: "D",
      enum: ["D", "S"],
    },

    packageKey: { type: String, required: true, trim: true },

    dimensions: {
      weight: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      length: { type: Number, default: 0 },
    },

    service: { type: String, default: "", trim: true },

    price: { type: Number, required: true },
    etaMin: { type: Number, default: 0 },
    etaMax: { type: Number, default: 0 },

    validTo: { type: String, default: null },
  },
  { timestamps: true }
);

// índice principal para recalcular agregados recientes por región + packageKey + deliveredType
ShippingRateSampleSchema.index({
  provider: 1,
  region: 1,
  packageKey: 1,
  deliveredType: 1,
  createdAt: -1,
});

// útil si después querés análisis o debugging por destino exacto
ShippingRateSampleSchema.index({
  postalCodeDestination: 1,
  packageKey: 1,
  deliveredType: 1,
  createdAt: -1,
});

// opcional: útil si más adelante querés análisis por zone
ShippingRateSampleSchema.index({
  zone: 1,
  packageKey: 1,
  deliveredType: 1,
  createdAt: -1,
});

// opcional: limpieza o consultas temporales
ShippingRateSampleSchema.index({
  createdAt: -1,
});

export const ShippingRateSample =
  mongoose.models.ShippingRateSample ||
  mongoose.model("ShippingRateSample", ShippingRateSampleSchema);