import { Schema, model, models } from "mongoose";

/**
 * Items
 */
const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    title: { type: String, default: "" },
    slug: { type: String, default: "" },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const MetaSchema = new Schema(
  {
    eventId: { type: String, default: "" },
    fbp: { type: String, default: "" },
    fbc: { type: String, default: "" },
    capiPurchaseSentAt: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * Buyer shipping address (address entered by the buyer)
 */
const BuyerShippingAddressSchema = new Schema(
  {
    province: { type: String, default: "" },
    city: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    streetName: { type: String, default: "" },
    streetNumber: { type: String, default: "" },
    apt: { type: String, default: "" },
    dni: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const BuyerSchema = new Schema(
  {
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, lowercase: true, trim: true, default: "" },

    // ✅ RENAMED: was buyer.shipping
    shippingAddress: { type: BuyerShippingAddressSchema, default: {} },
  },
  { _id: false }
);

/**
 * Correo Argentino label
 */
const CorreoLabelSchema = new Schema(
  {
    format: { type: String, default: "10x15" },
    fileName: { type: String, default: "" },
    base64: { type: String, default: "" }, // ⚠️ ideal: Storage + URL
    createdAt: { type: Date, default: null },
  },
  { _id: false }
);

const CorreoSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["", "creating", "created", "error"],
      default: "",
      index: true,
    },
    createdAt: { type: Date, default: null }, // claim idempotente
    lastError: { type: String, default: "" },

    agreement: { type: String, default: "" },
    sellerId: { type: String, default: "" },
    trackingNumber: { type: String, default: "" },

    label: { type: CorreoLabelSchema, default: {} },
  },
  { _id: false }
);

/**
 * ✅ RENAMED: root shipping provider/quote data
 * This avoids collisions with buyer shipping address.
 */
const ShippingDataSchema = new Schema(
  {
    provider: { type: String, default: "" }, // "zones" | "correo-argentino" | "andreani"
    deliveredType: { type: String, default: "D" }, // D / S etc
    postalCodeOrigin: { type: String, default: "" },
    postalCodeDestination: { type: String, default: "" },
    quote: {
      service: { type: String, default: "" },
      price: { type: Number, default: 0, min: 0 },
      eta: { type: String, default: "" },
      validTo: { type: Date, default: null },
    },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    publicCode: { type: String, required: true, unique: true, index: true },
    accessKey: { type: String, required: true, index: true },

    buyer: { type: BuyerSchema, default: {} },
    items: { type: [OrderItemSchema], required: true },

    itemsTotal: { type: Number, default: 0, min: 0 },
    shippingTotal: { type: Number, default: 0, min: 0 },

    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "ARS" },

    paidEmailSentAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ["pending", "pending_review", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },

    shippingStatus: {
      type: String,
      enum: ["pending", "created", "shipped", "delivered", "error"],
      default: "pending",
      index: true,
    },

    trackingCode: { type: String, default: "" },

    // ✅ string (coincide con tu UI y PATCH schema)
    adminNotes: { type: String, default: "" },

    // ✅ Correo Argentino
    correo: { type: CorreoSchema, default: {} },

    mp: {
      preferenceId: { type: String, required: true, index: true },

      // ✅ IMPORTANT: no default "" (evita choque del unique)
      paymentId: { type: String, default: undefined },
      processedAt: { type: Date, default: null },

      status: { type: String, default: "" },
      amount: { type: Number, default: 0, min: 0 },
      approvedAt: { type: Date, default: null },
      method: { type: String, default: "" },

      feeAmount: { type: Number, default: 0 },
      netAmount: { type: Number, default: 0 },

      lastPreferenceCreatedAt: { type: Date, default: null },

      mismatch: {
        paidAmount: { type: Number, default: 0 },
        expectedAmount: { type: Number, default: 0 },
      },
    },

    externalReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    meta: { type: MetaSchema, default: {} },

    utm: {
      source: { type: String, default: "" },
      medium: { type: String, default: "" },
      campaign: { type: String, default: "" },
      term: { type: String, default: "" },
      content: { type: String, default: "" },
    },

    landingPath: { type: String, default: "" },
    referrer: { type: String, default: "" },

    analyticsPaidRecordedAt: { type: Date, default: null },
    dailyMetricPaidRecordedAt: { type: Date, default: null },

    shippingData: { type: ShippingDataSchema, default: {} },

    shippedEmailSent: { type: Boolean, default: false },
    shippedEmailSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// ✅ Unique payment id only when present and non-empty
OrderSchema.index(
  { "mp.paymentId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "mp.paymentId": { $type: "string", $ne: "" },
    },
  }
);

OrderSchema.index({ "buyer.email": 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });

export const Order = models.Order || model("Order", OrderSchema);