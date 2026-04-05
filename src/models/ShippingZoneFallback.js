import mongoose from "mongoose";

const ShippingZoneFallbackSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "correo-argentino" },

    region: { type: String, required: true, trim: true },
    packageKey: { type: String, required: true, trim: true },
    deliveredType: { type: String, default: "D", enum: ["D", "S"] },

    // opcional pero útil para futuros fallbacks más finos
    zone: { type: String, default: "", trim: true },

    sampleCount: { type: Number, default: 0 },

    medianPrice: { type: Number, default: null },
    p75Price: { type: Number, default: null },

    etaMin: { type: Number, default: null },
    etaMax: { type: Number, default: null },

    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// match exacto
ShippingZoneFallbackSchema.index(
  { region: 1, packageKey: 1, deliveredType: 1 },
  { unique: true }
);

// fallback por packageKey + deliveredType
ShippingZoneFallbackSchema.index({
  packageKey: 1,
  deliveredType: 1,
  sampleCount: -1,
});

// fallback opcional por zone + packageKey + deliveredType
ShippingZoneFallbackSchema.index({
  zone: 1,
  packageKey: 1,
  deliveredType: 1,
  sampleCount: -1,
});

// fallback global
ShippingZoneFallbackSchema.index({
  sampleCount: -1,
});

export const ShippingZoneFallback =
  mongoose.models.ShippingZoneFallback ||
  mongoose.model("ShippingZoneFallback", ShippingZoneFallbackSchema);