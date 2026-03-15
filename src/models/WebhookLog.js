import { Schema, model, models } from "mongoose";

const WebhookLogSchema = new Schema(
  {
    provider: { type: String, default: "mercadopago", index: true },
    paymentId: { type: String, index: true },
    externalReference: { type: String, index: true },
    status: { type: String, default: "" },

    ok: { type: Boolean, default: false, index: true },
    error: { type: String, default: "" },

    tries: { type: Number, default: 0 },
    lastTriedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

WebhookLogSchema.index({ createdAt: -1 });

export const WebhookLog = models.WebhookLog || model("WebhookLog", WebhookLogSchema);
