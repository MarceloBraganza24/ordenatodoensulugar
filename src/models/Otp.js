import { Schema, model, models } from "mongoose";

const OtpSchema = new Schema(
  {
    email: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },

    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 8 },

    // opcional: anti-abuse (no perfecto, pero ayuda)
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

// TTL: se borra solo cuando expira
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Otp = models.Otp || model("Otp", OtpSchema);
