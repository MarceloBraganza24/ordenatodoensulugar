import { Schema, model, models } from "mongoose";

const DailyMetricSchema = new Schema(
  {
    day: { type: String, required: true, unique: true }, // YYYY-MM-DD

    counters: {
      type: Map,
      of: Number,
      default: {},
    },

    netPaid: { type: Number, default: 0 },
    feesPaid: { type: Number, default: 0 },

    revenuePaid: { type: Number, default: 0 },
    ordersPaid: { type: Number, default: 0 },

    itemsBySlug: { type: Map, of: Number, default: {} },
    revenueBySlug: { type: Map, of: Number, default: {} },

    utmRevenue: { type: Map, of: Number, default: {} }, // "source|campaign" -> revenue
  },
  { timestamps: true }
);

export const DailyMetric = models.DailyMetric || model("DailyMetric", DailyMetricSchema);
