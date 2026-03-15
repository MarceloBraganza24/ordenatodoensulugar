import { Schema, model, models } from "mongoose";

const IncludedItemSchema = new Schema(
  { label: String, qty: Number, ml: Number },
  { _id: false }
);

const ProductSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    kind: { type: String, enum: ["PACK", "SINGLE", "UPSELL"], required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    currency: { type: String, default: "ARS" },
    imageUrl: { type: String, required: true },
    badge: { type: String },
    features: { type: [String], default: [] },
    includedItems: { type: [IncludedItemSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Product = models.Product || model("Product", ProductSchema);
