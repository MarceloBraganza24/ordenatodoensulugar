"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import styles from "../OrdersPages.module.scss";
import { NavbarSuccess } from "@/components/NavbarSuccess";
import AdvertisingTape from "@/components/AdvertisingTape";

function copyTextFallback(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

export default function SuccessPage() {
  const cart = useCart();
  const didRun = useRef(false);

  const [code, setCode] = useState("");
  const [key, setKey] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  // idle | loading | ok | error
  const [portalStatus, setPortalStatus] = useState("idle");

  const orderUrl = useMemo(() => {
    if (!code || !key) return "";
    return `/order/${code}?key=${encodeURIComponent(key)}`;
  }, [code, key]);

  const fullUrl = useMemo(() => {
    if (!orderUrl) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${orderUrl}`;
  }, [orderUrl]);

  // 1) Resolver code/key (sessionStorage -> fallback external_reference)
  // 2) Limpiar carrito si approved
  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const run = async () => {
      const qs = new URLSearchParams(window.location.search);
      const status = qs.get("status") || qs.get("collection_status");

      // ✅ limpiar carrito si approved (aunque no tengamos code/key todavía)
      if (status === "approved") {
        cart.clear();
        cart.close?.();
      }

      // ✅ 1) leer de sessionStorage y SETEAR estado
      try {
        const c = sessionStorage.getItem("last_public_code") || "";
        const k = sessionStorage.getItem("last_access_key") || "";

        if (c && k) {
          setCode(c);
          setKey(k);
          return;
        }
      } catch {}

      // ✅ 2) fallback: external_reference -> buscar order -> setCode/setKey
      try {
        const externalRef =
          qs.get("external_reference") ||
          qs.get("externalReference") ||
          qs.get("external_ref");

        if (!externalRef) return;

        // ⬇️ ESTE endpoint debe devolver { publicCode, accessKey }
        const r = await fetch(
          `/api/order-status/by-external/${encodeURIComponent(externalRef)}`,
          { cache: "no-store" }
        );
        if (!r.ok) return;

        const j = await r.json().catch(() => ({}));
        if (j?.publicCode && j?.accessKey) {
          setCode(j.publicCode);
          setKey(j.accessKey);

          // opcional: persistir para otras pantallas
          try {
            sessionStorage.setItem("last_public_code", j.publicCode);
            sessionStorage.setItem("last_access_key", j.accessKey);
          } catch {}
        }
      } catch {}
    };

    run();
  }, [cart]);

  // 3) Claim portal cookie
  useEffect(() => {
    if (!code || !key) return;

    let cancelled = false;

    const run = async () => {
      setPortalStatus("loading");

      try {
        const r = await fetch("/api/public/portal/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicCode: code, accessKey: key }),
        });

        if (cancelled) return;

        const j = await r.json().catch(() => ({}));
        if (r.ok && j?.ok) setPortalStatus("ok");
        else setPortalStatus("error");
      } catch {
        if (!cancelled) setPortalStatus("error");
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [code, key]);

  const onCopy = async () => {
    if (!fullUrl) return;
    setCopyMsg("");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullUrl);
        setCopyMsg("Link copiado ✅");
        return;
      }
    } catch {}

    const ok = copyTextFallback(fullUrl);
    setCopyMsg(ok ? "Link copiado ✅" : "No se pudo copiar. Copialo manualmente.");
  };

  return (
    <>
      <AdvertisingTape />
      <NavbarSuccess />

      <main className={styles.page}>
        <h1 className={`${styles.chip} ${styles.chipOk}`}>¡Pago aprobado! ✅</h1>

        <p className={styles.subtitle}>
          Gracias por tu compra. En breve te contactamos para coordinar el envío.
        </p>

        {orderUrl ? (
          <div className={styles.actionsRow}>
            <a className={styles.linkStrong} href={orderUrl}>
              Seguimiento de mi pedido
            </a>

            <button className={styles.ghostBtn} onClick={onCopy}>
              Copiar link
            </button>

            {copyMsg && <p className={styles.toast}>{copyMsg}</p>}

            {portalStatus === "loading" ? (
              <p className={styles.muted}>Preparando acceso a “Mis pedidos”...</p>
            ) : portalStatus === "ok" ? (
              <p className={styles.muted}>
                ✅ Listo: ya podés ver tus pedidos sin código.{" "}
                <a className={styles.link} href="/mis-pedidos">
                  Ver mis pedidos
                </a>
              </p>
            ) : portalStatus === "error" ? (
              <p className={styles.muted}>
                Si querés ver todos tus pedidos más adelante, guardá este link (o pedinos tu código por WhatsApp).
              </p>
            ) : null}

            <p className={styles.muted}>Guardá este link para ver el estado del pago y del envío.</p>
          </div>
        ) : (
          <p className={styles.subtitle}>
            No pude generar el link del pedido. Si lo necesitás, pedinos tu código por WhatsApp.
          </p>
        )}

        <a className={styles.link} href="/">
          Volver al inicio
        </a>
      </main>
    </>
  );
}