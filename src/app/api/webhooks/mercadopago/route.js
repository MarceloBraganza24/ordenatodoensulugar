// src/app/api/webhooks/mercadopago/route.js
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { mpPayment } from "@/lib/mp";
import { sendOrderPaidEmail } from "@/lib/email";
import { WebhookLog } from "@/models/WebhookLog";
import { recordEvent as recordEventStore } from "@/lib/analyticsStore";

// ---------- helpers ----------
function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function tsFromPayment(payment) {
  const raw = payment?.date_approved || payment?.date_created;
  if (!raw) return new Date();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function isMpPaymentWebhook(req, body) {
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic");
  const type = url.searchParams.get("type");
  const dataId = url.searchParams.get("data.id");
  const bodyId = body?.data?.id || body?.id;

  if (topic === "payment") return true;
  if (type === "payment") return true;
  if (dataId || bodyId) return true;

  return false;
}

function buildOrderUrl(order) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${siteUrl}/order/${order.publicCode}?key=${encodeURIComponent(
    order.accessKey
  )}`;
}

function amountsMatch(paid, expected, tolerance = 1) {
  const a = Number(paid);
  const b = Number(expected);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  return Math.abs(a - b) <= tolerance;
}

function dayFromDateAR(d) {
  const dt = new Date(d);
  dt.setHours(dt.getHours() - 3); // Ajuste Argentina UTC-3
  return dt.toISOString().slice(0, 10);
}

function isDifferentOrderWithSamePayment(existing, orderId) {
  if (!existing) return false;
  return String(existing._id) !== String(orderId);
}

// ---------- Correo Argentino ----------
function getCorreoBaseUrl() {
  return (
    process.env.CORREO_API_BASE ||
    "https://apitest.correoargentino.com.ar/paqar/v1"
  );
}

function correoHeaders() {
  const apiKey = process.env.CORREO_API_KEY || "";
  const agreement = process.env.CORREO_AGREEMENT || "";
  return {
    Authorization: `Apikey ${apiKey}`,
    agreement: agreement,
    "Content-Type": "application/json",
  };
}

async function correoAuthOk() {
  const base = getCorreoBaseUrl();
  const r = await fetch(`${base}/auth`, {
    method: "GET",
    headers: correoHeaders(),
    cache: "no-store",
  });
  return r.status === 204;
}

function normalizeZip(zip) {
  return String(zip || "").trim();
}

function stateCodeFromProvinceNameOrCode(province) {
  const p = String(province || "").trim().toUpperCase();
  if (p.length === 1) return p;

  const map = {
    "BUENOS AIRES": "B",
    "CIUDAD AUTONOMA DE BUENOS AIRES": "C",
    "CABA": "C",
    "CORDOBA": "X",
    "SANTA FE": "S",
    "MENDOZA": "M",
    "ENTRE RIOS": "E",
    "RIO NEGRO": "R",
    "NEUQUEN": "Q",
    "CHUBUT": "U",
    "TUCUMAN": "T",
  };
  return map[p] || "";
}

function buildCorreoOrderPayload(order) {
  const buyer = order?.buyer || {};
  const ship = buyer?.shippingAddress || {};
  const zip = normalizeZip(ship?.postalCode);
  const state = stateCodeFromProvinceNameOrCode(ship?.province);

  const senderZip = process.env.CORREO_SENDER_ZIP || "";
  const senderState = process.env.CORREO_SENDER_STATE || "";
  const senderCity = process.env.CORREO_SENDER_CITY || "";
  const senderStreet = process.env.CORREO_SENDER_STREET || "";
  const senderNumber = process.env.CORREO_SENDER_NUMBER || "";
  const senderBusiness = process.env.CORREO_SENDER_BUSINESS || "ORDENA";

  const senderPhoneArea = process.env.CORREO_SENDER_AREA_PHONE || "";
  const senderPhone = process.env.CORREO_SENDER_PHONE || "";
  const senderEmail = process.env.CORREO_SENDER_EMAIL || "";

  const weightGrams = String(process.env.CORREO_DEFAULT_WEIGHT_GRAMS || "2000");
  const height = String(process.env.CORREO_DEFAULT_H || "20");
  const width = String(process.env.CORREO_DEFAULT_W || "20");
  const depth = String(process.env.CORREO_DEFAULT_D || "20");

  const declaredValue = String(Math.round(safeNum(order?.total) || 0));

  const service = order?.shippingData?.quote?.service || "";

  const deliveryType = service === "pickup" ? "agency" : "homeDelivery";
  const agencyId =
    deliveryType === "agency" ? order?.shippingAgencyId || "" : "";
  const serviceType = String(service || "CP").slice(0, 2);

  return {
    sellerId: "",
    trackingNumber: "",
    order: {
      senderData: {
        id: "",
        businessName: senderBusiness,
        areaCodePhone: senderPhoneArea,
        phoneNumber: senderPhone,
        areaCodeCellphone: "",
        cellphoneNumber: "",
        email: senderEmail,
        observation: "",
        address: {
          streetName: senderStreet,
          streetNumber: senderNumber,
          cityName: senderCity,
          floor: "",
          department: "",
          state: senderState,
          zipCode: senderZip,
        },
      },
      shippingData: {
        name: String(buyer?.name || "").trim(),
        areaCodePhone: "",
        phoneNumber: "",
        areaCodeCellphone: "",
        cellphoneNumber: String(buyer?.phone || "").trim(),
        email: String(buyer?.email || "").trim(),
        observation: String(ship?.notes || "").trim(),
        address: {
          streetName: String(ship?.streetName || "").trim(),
          streetNumber: String(ship?.streetNumber || "").trim(),
          cityName: String(ship?.city || "").trim(),
          floor: "",
          department: String(ship?.apt || "").trim(),
          state,
          zipCode: zip,
        },
      },
      parcels: [
        {
          dimensions: { height, width, depth },
          productWeight: weightGrams,
          productCategory: "ecommerce",
          declaredValue,
        },
      ],
      deliveryType,
      agencyId,
      saleDate: new Date(order?.createdAt || Date.now()).toISOString(),
      shipmentClientId: String(order?.publicCode || ""),
      serviceType,
    },
  };
}

async function correoCreateOrder(order) {
  const base = getCorreoBaseUrl();
  const payload = buildCorreoOrderPayload(order);

  const r = await fetch(`${base}/orders`, {
    method: "POST",
    headers: correoHeaders(),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!r.ok) {
    const msg =
      json?.message ||
      json?.error ||
      text ||
      `Correo createOrder failed (${r.status})`;
    throw new Error(msg);
  }

  const tn = json?.trackingNumber || json?.order?.trackingNumber;
  return { raw: json, trackingNumber: tn || "" };
}

async function correoGetLabel({
  sellerId = "",
  trackingNumber,
  labelFormat = "10x15",
}) {
  const base = getCorreoBaseUrl();
  const qs = labelFormat
    ? `?labelFormat=${encodeURIComponent(labelFormat)}`
    : "";

  const body = [{ sellerId: sellerId || "", trackingNumber }];

  const r = await fetch(`${base}/labels${qs}`, {
    method: "POST",
    headers: correoHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!r.ok) {
    const msg =
      json?.message ||
      json?.error ||
      text ||
      `Correo getLabel failed (${r.status})`;
    throw new Error(msg);
  }

  const first = Array.isArray(json) ? json[0] : null;
  return {
    raw: json,
    fileBase64: first?.fileBase64 || "",
    fileName: first?.fileName || "",
    result: first?.result || "",
  };
}

// ---------- route ----------
export async function POST(req) {
  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id");

  let body = null;
  try {
    body = await req.json();
  } catch {}

  if (!isMpPaymentWebhook(req, body)) {
    return NextResponse.json({ ok: true });
  }

  const paymentId = dataId || body?.data?.id || body?.id;
  if (!paymentId) return NextResponse.json({ ok: true });

  try {
    await connectDB();

    const payment = await mpPayment().get({ id: String(paymentId) });
    const status = payment?.status;
    const externalReference = payment?.external_reference;

    if (!externalReference) return NextResponse.json({ ok: true });

    let logDoc = null;
    try {
      logDoc = await WebhookLog.findOneAndUpdate(
        { provider: "mercadopago", paymentId: String(paymentId) },
        {
          $set: {
            paymentId: String(paymentId),
            externalReference: String(externalReference || ""),
            status: String(status || ""),
            lastTriedAt: new Date(),
          },
          $inc: { tries: 1 },
        },
        { upsert: true, new: true }
      );
    } catch {}

    const order = await Order.findOne({ externalReference });
    if (!order) return NextResponse.json({ ok: true });

    const paymentIdStr = String(paymentId);

    // =========================
    // APPROVED
    // =========================
    if (status === "approved") {
      const existingByPaymentId = await Order.findOne({
        "mp.paymentId": paymentIdStr,
      });

      if (isDifferentOrderWithSamePayment(existingByPaymentId, order._id)) {
        console.error("[MP webhook] paymentId already linked to another order", {
          paymentId: paymentIdStr,
          currentOrderId: String(order._id),
          existingOrderId: String(existingByPaymentId._id),
          externalReference,
        });

        try {
          if (logDoc?._id) {
            await WebhookLog.updateOne(
              { _id: logDoc._id },
              {
                $set: {
                  ok: false,
                  error: "paymentId already linked to another order",
                },
              }
            );
          }
        } catch {}

        return NextResponse.json({ ok: true, conflict: true });
      }

      const paidAmount = safeNum(payment?.transaction_amount);
      const expectedAmount = safeNum(order?.total);

      const feeAmount = Array.isArray(payment?.fee_details)
        ? payment.fee_details.reduce((acc, f) => acc + safeNum(f?.amount), 0)
        : 0;

      const netAmount = safeNum(
        payment?.transaction_details?.net_received_amount ??
          (paidAmount - feeAmount)
      );

      if (!amountsMatch(paidAmount, expectedAmount, 1)) {
        console.warn("[MP webhook] amount mismatch", {
          paymentId: paymentIdStr,
          externalReference,
          paidAmount,
          expectedAmount,
        });

        order.mp.paymentId = paymentIdStr;
        order.mp.status = "approved";
        order.mp.amount = paidAmount;
        order.mp.approvedAt = tsFromPayment(payment);
        order.mp.method = payment?.payment_method_id || "";
        order.mp.mismatch = { paidAmount, expectedAmount };
        order.mp.feeAmount = feeAmount;
        order.mp.netAmount = netAmount;

        if (order.status !== "paid") order.status = "pending_review";

        await order.save();

        try {
          if (logDoc?._id) {
            await WebhookLog.updateOne(
              { _id: logDoc._id },
              { $set: { ok: true, error: "" } }
            );
          }
        } catch {}

        return NextResponse.json({ ok: true });
      }

      if (order.status !== "paid") order.status = "paid";

      order.mp.paymentId = paymentIdStr;
      order.mp.status = "approved";
      order.mp.amount = paidAmount;
      order.mp.approvedAt = tsFromPayment(payment);
      order.mp.method = payment?.payment_method_id || "";
      order.mp.feeAmount = feeAmount;
      order.mp.netAmount = netAmount;

      await order.save();

      const freshOrder = await Order.findById(order._id);
      if (!freshOrder) return NextResponse.json({ ok: true });

      const paymentClaim = await Order.updateOne(
        {
          _id: freshOrder._id,
          "mp.paymentId": paymentIdStr,
          "mp.processedAt": null,
        },
        { $set: { "mp.processedAt": new Date() } }
      );

      if (paymentClaim.modifiedCount !== 1) {
        return NextResponse.json({ ok: true, dedup: true });
      }

      // 2.1) Meta CAPI Purchase
      const capiClaim = await Order.updateOne(
        { _id: freshOrder._id, "meta.capiPurchaseSentAt": null },
        { $set: { "meta.capiPurchaseSentAt": new Date() } }
      );

      if (capiClaim.modifiedCount === 1) {
        try {
          const { sendCapiEvent } = await import("@/lib/meta/capi");
          const { sha256 } = await import("@/lib/meta/hash");

          const eventId = String(
            freshOrder?.meta?.eventId || `purchase_${freshOrder._id}`
          );
          const value = safeNum(freshOrder?.total);
          const currency = freshOrder?.currency || "ARS";
          const userAgent = req?.headers?.get?.("user-agent") || "";

          const capiRes = await sendCapiEvent({
            event_name: "Purchase",
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            action_source: "website",
            user_data: {
              em: sha256(freshOrder?.buyer?.email || ""),
              ph: sha256(freshOrder?.buyer?.phone || ""),
              fbp: freshOrder?.meta?.fbp || undefined,
              fbc: freshOrder?.meta?.fbc || undefined,
              client_user_agent: userAgent || undefined,
            },
            custom_data: {
              value,
              currency,
              content_type: "product",
              content_ids: (freshOrder.items || []).map((it) => it.slug),
              contents: (freshOrder.items || []).map((it) => ({
                id: it.slug,
                quantity: safeNum(it.qty),
                item_price: safeNum(it.unitPrice),
              })),
              num_items: (freshOrder.items || []).reduce(
                (acc, it) => acc + safeNum(it.qty),
                0
              ),
            },
          });

          console.log("[Meta CAPI] Purchase result:", capiRes);
        } catch (e) {
          console.error("[Meta CAPI] Purchase send failed:", e);
        }
      }

      // 3) Analytics
      const claimed = await Order.updateOne(
        { _id: freshOrder._id, dailyMetricPaidRecordedAt: null },
        { $set: { dailyMetricPaidRecordedAt: new Date() } }
      );

      if (claimed.modifiedCount === 1) {
        const ts = tsFromPayment(payment);
        const day = dayFromDateAR(ts);

        try {
          await recordEventStore({
            type: "purchase_paid",
            ts,
            sid: "",
            path: freshOrder.landingPath || "",
            ref: freshOrder.referrer || "",
            utm: freshOrder.utm || {},
            order: {
              publicCode: freshOrder.publicCode,
              total: safeNum(freshOrder.total),
              currency: freshOrder.currency || "ARS",
              status: "paid",
            },
            meta: { paymentId: paymentIdStr, feeAmount, netAmount, day },
          });

          for (const it of freshOrder.items || []) {
            await recordEventStore({
              type: "purchase_item_paid",
              ts,
              sid: "",
              path: freshOrder.landingPath || "",
              ref: freshOrder.referrer || "",
              utm: freshOrder.utm || {},
              product: {
                slug: it.slug,
                qty: safeNum(it.qty),
                price: safeNum(it.unitPrice),
              },
              order: {
                publicCode: freshOrder.publicCode,
                total: safeNum(freshOrder.total),
                currency: freshOrder.currency || "ARS",
                status: "paid",
              },
              meta: { paymentId: paymentIdStr, feeAmount, netAmount, day },
            });
          }
        } catch (e) {
          console.warn("[analyticsStore] purchase record failed:", e);
        }
      }

      const shippingProvider = String(
        freshOrder?.shippingData?.provider || ""
      ).toLowerCase();
      const shippingPrice = Number(freshOrder?.shippingTotal || 0);

      const shouldCreateCorreoShipment =
        shippingProvider !== "local" &&
        shippingProvider !== "promo" &&
        shippingPrice > 0;

      // 4) Correo Argentino
      const canTryCorreo =
        !!process.env.CORREO_API_KEY && !!process.env.CORREO_AGREEMENT;

      if (canTryCorreo && shouldCreateCorreoShipment) {
        const claim = await Order.updateOne(
          { _id: freshOrder._id, "correo.createdAt": null },
          {
            $set: {
              "correo.createdAt": new Date(),
              "correo.status": "creating",
              "correo.lastError": "",
            },
          }
        );

        if (claim.modifiedCount === 1) {
          try {
            const ok = await correoAuthOk();
            if (!ok) throw new Error("Correo auth failed (bad key/agreement)");

            const { trackingNumber } = await correoCreateOrder(freshOrder);
            if (!trackingNumber) {
              throw new Error("Correo did not return trackingNumber");
            }

            const label = await correoGetLabel({
              sellerId: "",
              trackingNumber,
              labelFormat: "10x15",
            });

            await Order.updateOne(
              { _id: freshOrder._id },
              {
                $set: {
                  trackingCode: trackingNumber,
                  shippingStatus: "created",
                  "correo.status": "created",
                  "correo.trackingNumber": trackingNumber,
                  "correo.label.format": "10x15",
                  "correo.label.fileName": label.fileName || "",
                  "correo.label.base64": label.fileBase64 || "",
                  "correo.label.createdAt": new Date(),
                  "correo.lastError": "",
                },
              }
            );
          } catch (e) {
            console.error("[Correo] create shipment failed:", e);

            await Order.updateOne(
              { _id: freshOrder._id },
              {
                $set: {
                  shippingStatus: "error",
                  "correo.status": "error",
                  "correo.lastError": String(e?.message || e),
                },
              }
            );
          }
        }
      }

      // 5) Email
      const to = String(freshOrder?.buyer?.email || "").trim();
      if (!to) {
        console.warn("[MP webhook] missing buyer.email, cannot send paid email");
      } else {
        const emailClaim = await Order.updateOne(
          { _id: freshOrder._id, paidEmailSentAt: null },
          { $set: { paidEmailSentAt: new Date() } }
        );

        if (emailClaim.modifiedCount === 1) {
          const orderUrl = buildOrderUrl(freshOrder);

          try {
            const r = await sendOrderPaidEmail({
              to,
              order: {
                publicCode: freshOrder.publicCode,
                total: freshOrder.total,
                currency: freshOrder.currency,
                items: freshOrder.items,
              },
              orderUrl,
            });

            console.log("[MP webhook] email sent:", r);
          } catch (e) {
            console.error("[MP webhook] paid email send failed:", e);
          }
        }
      }

      const finalOrder = await Order.findById(freshOrder._id).lean();

      if (finalOrder) {
        console.log("[MP webhook] approved processed ok", {
          publicCode: finalOrder.publicCode,
          status: finalOrder.status,
          paymentId: finalOrder?.mp?.paymentId || "",
          mpStatus: finalOrder?.mp?.status || "",
          mpProcessedAt: finalOrder?.mp?.processedAt || null,
          paidEmailSentAt: finalOrder?.paidEmailSentAt || null,
          shippingStatus: finalOrder?.shippingStatus || "",
          correoStatus: finalOrder?.correo?.status || "",
        });
      }

      try {
        if (logDoc?._id) {
          await WebhookLog.updateOne(
            { _id: logDoc._id },
            { $set: { ok: true, error: "" } }
          );
        }
      } catch {}

      return NextResponse.json({ ok: true });
    }

    // =========================
    // REJECTED / CANCELLED
    // =========================
    if (status === "rejected" || status === "cancelled") {
      if (order.status !== "paid") {
        order.status = "failed";
        order.mp.paymentId = paymentIdStr;
        order.mp.status = String(status || "");
        order.mp.amount = safeNum(payment?.transaction_amount);
        order.mp.method = payment?.payment_method_id || "";
        await order.save();
      }

      try {
        if (logDoc?._id) {
          await WebhookLog.updateOne(
            { _id: logDoc._id },
            { $set: { ok: true, error: "" } }
          );
        }
      } catch {}

      return NextResponse.json({ ok: true });
    }

    // =========================
    // PENDING / IN_PROCESS
    // =========================
    if (status === "pending" || status === "in_process") {
      if (order.status !== "paid") {
        order.status = "pending";
        order.mp.paymentId = paymentIdStr;
        order.mp.status = String(status || "");
        order.mp.amount = safeNum(payment?.transaction_amount);
        order.mp.method = payment?.payment_method_id || "";
        await order.save();
      }

      try {
        if (logDoc?._id) {
          await WebhookLog.updateOne(
            { _id: logDoc._id },
            { $set: { ok: true, error: "" } }
          );
        }
      } catch {}

      return NextResponse.json({ ok: true });
    }

    // =========================
    // REFUNDED / CHARGED_BACK
    // =========================
    if (status === "refunded" || status === "charged_back") {
      order.status = "refunded";
      order.mp.paymentId = paymentIdStr;
      order.mp.status = String(status || "");
      order.mp.amount = safeNum(payment?.transaction_amount);
      order.mp.method = payment?.payment_method_id || "";
      await order.save();

      try {
        if (logDoc?._id) {
          await WebhookLog.updateOne(
            { _id: logDoc._id },
            { $set: { ok: true, error: "" } }
          );
        }
      } catch {}

      return NextResponse.json({ ok: true });
    }

    try {
      if (logDoc?._id) {
        await WebhookLog.updateOne(
          { _id: logDoc._id },
          { $set: { ok: true, error: "" } }
        );
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e) {
    try {
      if (paymentId) {
        await WebhookLog.findOneAndUpdate(
          { provider: "mercadopago", paymentId: String(paymentId) },
          {
            $set: {
              ok: false,
              error: String(e?.message || e),
              lastTriedAt: new Date(),
            },
            $inc: { tries: 1 },
          },
          { upsert: true }
        );
      }
    } catch {}

    console.error("MP webhook error:", e);
    return NextResponse.json({ ok: true });
  }
}