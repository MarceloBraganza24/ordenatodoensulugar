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
    "x-ref": typeof document !== "undefined" ? (document.referrer || "") : "",
    "x-utm-source": sessionStorage.getItem("utm_source") || "",
    "x-utm-medium": sessionStorage.getItem("utm_medium") || "",
    "x-utm-campaign": sessionStorage.getItem("utm_campaign") || "",
    "x-utm-term": sessionStorage.getItem("utm_term") || "",
    "x-utm-content": sessionStorage.getItem("utm_content") || "",
  };
}

export async function startCheckout(items, buyer, extra = {}) {
  const eventId = newEventId("checkout");
  const fbp = getFbp();
  const fbc = getFbc();

  const total =
    Array.isArray(items)
      ? items.reduce(
          (acc, it) =>
            acc + Number(it?.unitPrice || 0) * Number(it?.qty || 0),
          0
        )
      : 0;

  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getUtmHeaders(),
    },
    body: JSON.stringify({
      items,
      buyer,
      zip: extra?.zip || "",
      shipping: extra?.shipping || null,
      meta: { eventId, fbp, fbc },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Checkout error");

  // ✅ Track solo si la orden se creó correctamente
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

  window.location.href = data.init_point;
}