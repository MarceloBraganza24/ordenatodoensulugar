"use client";

import { useEffect } from "react";
import { useCart } from "@/context/CartContext";

export default function PaymentRecovery() {
  const cart = useCart();

  useEffect(() => {
    async function checkOrder() {
      try {
        const externalRef = sessionStorage.getItem("last_external_reference");
        if (!externalRef) return;

        const r = await fetch(`/api/order-status?externalReference=${externalRef}`);
        const j = await r.json().catch(() => ({}));

        if (!j?.ok) return;

        // si ya está pagado
        if (j.status === "paid") {
          cart.clear();
          cart.close?.();

          //console.log("✅ Order already paid. Cart cleared.");
        }
      } catch (e) {
        console.warn("payment recovery failed", e);
      }
    }

    checkOrder();
  }, [cart]);

  return null;
}