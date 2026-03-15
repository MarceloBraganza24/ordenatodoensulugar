import mongoose from "mongoose";

const RegretRequestSchema = new mongoose.Schema(
  {
    orderCode: { type: String, default: null }, // opcional
    name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    dni: { type: String, default: null },
    reason: { type: String, default: null },

    // metadata útil
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true } // createdAt / updatedAt
);

export const RegretRequest =
  mongoose.models.RegretRequest || mongoose.model("RegretRequest", RegretRequestSchema);
