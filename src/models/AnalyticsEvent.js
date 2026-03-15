import { Schema, model, models } from "mongoose";

const UTM = new Schema(
  { source: String, medium: String, campaign: String, term: String, content: String },
  { _id: false }
);

const Product = new Schema(
  { slug: String, title: String, price: Number, qty: Number },
  { _id: false }
);

const Order = new Schema(
  { publicCode: String, total: Number, currency: String, status: String },
  { _id: false }
);

const AnalyticsEventSchema = new Schema(
  {
    type: { type: String, required: true },
    ts: { type: Date, default: Date.now, },

    // session / context
    sid: { type: String, index: true },
    path: { type: String, index: true },
    ref: { type: String },

    // privacy-friendly fingerprints
    ipHash: { type: String, index: true },
    uaHash: { type: String },

    utm: { type: UTM, default: {} },

    product: { type: Product, default: null },
    order: { type: Order, default: null },

    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

AnalyticsEventSchema.index({ type: 1, ts: -1 });

export const AnalyticsEvent = models.AnalyticsEvent || model("AnalyticsEvent", AnalyticsEventSchema);
