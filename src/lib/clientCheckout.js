import { getFbp, getFbc, newEventId } from "@/lib/meta/browserIds";
import { track } from "@/lib/meta/pixel";

function saveMyOrder(order) {
  try {
    const key = "my_orders";
    const prev = JSON.parse(localStorage.getItem(key) || "[]");

    const next = [
      order,
      ...prev.filter((o) => o.publicCode !== order.publicCode),
    ].slice(0, 10);

    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
}

function getUtmHeaders() {
  return {
    "x-path": typeof window !== "undefined" ? window.location.pathname : "",
    "x-ref": typeof document !== "undefined" ? document.referrer || "" : "",
    "x-utm-source": sessionStorage.getItem("utm_source") || "",
    "x-utm-medium": sessionStorage.getItem("utm_medium") || "",
    "x-utm-campaign": sessionStorage.getItem("utm_campaign") || "",
    "x-utm-term": sessionStorage.getItem("utm_term") || "",
    "x-utm-content": sessionStorage.getItem("utm_content") || "",
  };
}

function toErrorMessage(value) {
  if (!value) return "";

  if (typeof value === "string") return value;

  if (value instanceof Error) return value.message || "Error inesperado.";

  if (typeof value === "object") {
    if (typeof value.message === "string" && value.message.trim()) {
      return value.message;
    }

    if (typeof value.error === "string" && value.error.trim()) {
      return value.error;
    }

    if (Array.isArray(value.errors) && value.errors.length > 0) {
      const first = value.errors[0];

      if (typeof first === "string") return first;
      if (first && typeof first.message === "string") return first.message;
    }

    if (value.fieldErrors) {
      const flatErrors = Object.entries(value.fieldErrors)
        .flatMap(([field, messages]) =>
          Array.isArray(messages)
            ? messages.map((msg) => `${field}: ${msg}`)
            : []
        )
        .filter(Boolean);

      if (flatErrors.length) return flatErrors.join(" | ");
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "Error inesperado.";
    }
  }

  return String(value);
}

export async function startCheckout(items, buyer, extra = {}) {
  const eventId = newEventId("checkout") || "";
  const fbp = getFbp() || "";
  const fbc = getFbc() || "";

  const total = Number(extra?.orderValue || 0);

  const payload = {
    items,
    buyer,
    zip: extra?.zip || "",
    shipping: extra?.shipping || null,
    meta: {
      eventId: String(eventId || ""),
      fbp: String(fbp || ""),
      fbc: String(fbc || ""),
    },
  };


  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getUtmHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.ok) {
    const msg =
      toErrorMessage(data?.error) ||
      toErrorMessage(data?.message) ||
      toErrorMessage(data) ||
      "No se pudo iniciar el checkout.";

    throw new Error(msg);
  }

  const initPoint = data?.initPoint || data?.init_point || "";

  if (!initPoint) {
    throw new Error("La respuesta no incluyó initPoint.");
  }

  try {
    track("InitiateCheckout", { value: total, currency: "ARS" }, eventId);
  } catch {}

  try {
    sessionStorage.setItem(
      "last_external_reference",
      data.externalReference || ""
    );
    sessionStorage.setItem("last_public_code", data.publicCode || "");
    sessionStorage.setItem("last_access_key", data.accessKey || "");
    sessionStorage.setItem("last_meta_event_id", eventId);
  } catch {}

  if (data.publicCode && data.accessKey) {
    saveMyOrder({
      publicCode: data.publicCode,
      accessKey: data.accessKey,
      createdAt: new Date().toISOString(),
    });
  }

  window.location.href = initPoint;
}