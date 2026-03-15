"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import styles from "../../OrdersPages.module.scss";

function fmtDate(d) {
  try { return new Date(d).toLocaleString("es-AR"); } catch { return d; }
}

export default function OrderPage() {
  const { code } = useParams(); // ✅ acá ya viene resuelto
  const [order, setOrder] = useState(null);
  const [msg, setMsg] = useState("Cargando...");

  useEffect(() => {
    const run = async () => {
      const qs = new URLSearchParams(window.location.search);
      const key = qs.get("key");
      if (!key) {
        setMsg("Falta la clave del pedido (key).");
        return;
      }

      await fetch("/api/public/login-from-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, key })
      });

      const res = await fetch(
        `/api/public/orders/${encodeURIComponent(code)}?key=${encodeURIComponent(key)}`
      );

      if (!res.ok) {
        setMsg("No se pudo acceder al pedido. Revisá el link.");
        return;
      }

      const data = await res.json();
      setOrder(data.order);
      setMsg("");
    };

    if (code) run();
  }, [code]);

  if (msg) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Tu compra</h1>

        <div className={styles.card}>
          <p className={styles.subtitle}>{msg}</p>
        </div>

        <a className={styles.link} href="/">
          Volver al inicio
        </a>
      </main>
    );
  }

  return (
    <>
      <div className={styles.card}>
        <div className={styles.orderMeta}>
          <div><span>Pedido</span><br />{order.publicCode}</div>
          <div><span>Fecha</span><br />{fmtDate(order.createdAt)}</div>
          <div><span>Pago</span><br />{order.status}</div>
          <div><span>Envío</span><br />{order.shippingStatus}</div>
          <div><span>Tracking</span><br />{order.trackingCode || "-"}</div>
        </div>
      </div>

      <div className={styles.card}>
        <h2>Comprador</h2>
        <div className={styles.orderMeta}>
          <div><span>Nombre</span><br />{order.buyer?.name || "-"}</div>
          <div><span>Tel</span><br />{order.buyer?.phone || "-"}</div>
          <div><span>Email</span><br />{order.buyer?.email || "-"}</div>
        </div>
      </div>

      <div className={styles.card}>
        <h2>Productos</h2>

        <ul className={styles.products}>
          {order.items.map((it, idx) => (
            <li key={idx}>
              {it.qty} × {it.title} — {it.unitPrice} ARS
            </li>
          ))}
        </ul>

        <div className={styles.total}>
          Total: {order.total} {order.currency}
        </div>
        <a className={styles.link} href="/">
          Volver al inicio
        </a>
      </div>
    </>
  );
}
