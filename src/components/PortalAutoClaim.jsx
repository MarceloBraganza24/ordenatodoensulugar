"use client";

import { useEffect, useRef } from "react";

async function tryClaim(publicCode, accessKey) {
  const r = await fetch("/api/public/portal/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // OJO: claim necesita code + key, NO email
    body: JSON.stringify({ publicCode, accessKey }),
  });

  if (!r.ok) return false;
  const j = await r.json().catch(() => ({}));
  return !!j?.ok;
}

export default function PortalAutoClaim() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      // Evitar spam en cada page load
      try {
        const last = sessionStorage.getItem("portal_claim_done");
        if (last === "1") return;
      } catch {}

      let orders = [];
      try {
        orders = JSON.parse(localStorage.getItem("my_orders") || "[]");
      } catch {
        orders = [];
      }

      if (!Array.isArray(orders) || orders.length === 0) return;

      // Probamos las más recientes primero
      for (const o of orders.slice(0, 5)) {
        const code = o?.publicCode;
        const key = o?.accessKey;
        if (!code || !key) continue;

        const ok = await tryClaim(code, key);
        if (ok) {
          try {
            sessionStorage.setItem("portal_claim_done", "1");
          } catch {}
          break;
        }
      }
    })();
  }, []);

  return null;
}