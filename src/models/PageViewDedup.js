import { Schema, model, models } from "mongoose";

const PageViewDedupSchema = new Schema(
  {
    sid: { type: String, required: true, index: true },
    path: { type: String, required: true, index: true },
    windowKey: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 2 }, // 2 días
  },
  { timestamps: false }
);

PageViewDedupSchema.index(
  { sid: 1, path: 1, windowKey: 1 },
  { unique: true }
);

export const PageViewDedup =
  models.PageViewDedup || model("PageViewDedup", PageViewDedupSchema);