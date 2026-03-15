// src/lib/shipping/provider.js

function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

function normZip(zip) {
  return onlyDigits(zip).slice(0, 4);
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Contrato estable:
 * quoteShipping({ zip, items, buyer }) => { carrier, service, price, eta }
 */
export async function quoteShipping({ zip, items = [], buyer = null } = {}) {
  const z = normZip(zip);
  if (!z || z.length !== 4) {
    const err = new Error("Código postal inválido.");
    err.code = "ZIP_INVALID";
    throw err;
  }

  // ✅ FAKE provider (hoy)
  // mañana reemplazás este bloque por Andreani real
  const base = 4990;
  const qty = items.reduce((a, it) => a + safeNum(it.qty || 0), 0);

  return {
    carrier: "Andreani",
    service: "Estándar",
    price: base + Math.max(0, qty - 1) * 250, // opcional
    eta: "3-6 días hábiles",
  };
}