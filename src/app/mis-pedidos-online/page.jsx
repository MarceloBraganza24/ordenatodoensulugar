"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatARS } from "@/lib/money";

function fmtDate(d) {
  try { return new Date(d).toLocaleString("es-AR"); } catch { return d; }
}

export default function MisPedidosOnlinePage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState("Cargando...");
  const [retrying, setRetrying] = useState(false);
  const [retryErr, setRetryErr] = useState("");

  useEffect(() => {
    const run = async () => {
      const res = await fetch("/api/public/my-orders");
      if (res.status === 401) {
        router.push("/buscar");
        return;
      }
      if (!res.ok) {
        setMsg("No se pudieron cargar tus pedidos.");
        return;
      }
      const data = await res.json();
      setOrders(data.orders || []);
      setMsg("");
    };

    run();
  }, []);

  

  return (
    <main className="ordersPage">
      <div className="ordersCard">

        <button
          className="ordersLogout"
          type="button"
          onClick={async () => {
            await fetch("/api/public/logout", { method:"POST" });
            location.href="/buscar";
          }}
        >
          Salir
        </button>

        <h1 className="ordersTitle">Mis pedidos</h1>

        {msg ? <p className="ordersMessage">{msg}</p> : null}

        {!msg && orders.length === 0 ? (
          <p className="ordersEmpty">No encontramos pedidos con ese email.</p>
        ) : null}

        <ul className="ordersList">
          {orders.map((o) => {
            const statusKey = (o.status || "").toLowerCase?.() || "pending";
            const paymentLabel =
              {
                pending: "Pendiente de pago",
                pending_review: "En revisión",
                paid: "Pagado",
                failed: "Fallido",
                refunded: "Reembolsado",
              }[statusKey] || o.status;

            const shippingLabel =
              {
                pending: "Preparando",
                shipped: "Despachado",
                delivered: "Entregado",
              }[(o.shippingStatus || "").toLowerCase?.() || "pending"] || o.shippingStatus;

            const hasTracking = !!o.trackingCode;
            const hasMpMethod = !!o.mp?.method;
            const approvedAt = o.mp?.approvedAt ? fmtDate(o.mp.approvedAt) : "";

            
            const canRetryPay = o?.canRetryPay;

            const itemsCount = Array.isArray(o.items)
              ? o.items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0)
              : 0;

            // Si tus montos son números en ARS, podés cambiar a formatARS(o.itemsTotal) etc.
            const money = (n) =>
              typeof formatARS === "function"
                ? formatARS(Number(n || 0))
                : `${Number(n || 0)} ${o.currency || "ARS"}`;

            const onRetryPay = async () => {
              if (!o?.publicCode) return;

              setRetrying(true);
              setRetryErr("");

              try {
                const r = await fetch(`/api/public/my-orders/${encodeURIComponent(o.publicCode)}`, {
                  method: "POST",
                });

                const j = await r.json().catch(() => ({}));

                if (!r.ok) {
                  if (r.status === 429) {
                    setRetryErr(j?.error || "Esperá unos segundos antes de volver a intentar.");
                    return;
                  }

                  setRetryErr(j?.error || "No se pudo generar el link de pago. Probá de nuevo.");
                  return;
                }

                if (j?.init_point) {
                  window.location.href = j.init_point;
                  return;
                }

                setRetryErr("No se pudo generar el link de pago. Probá de nuevo.");
              } catch {
                setRetryErr("No se pudo generar el link de pago. Probá de nuevo.");
              } finally {
                setRetrying(false);
              }
            };

            return (
              <li className="ordersItem" key={o.publicCode}>
                {/* Header */}
                <div className="ordersItem__top">
                  <strong className="ordersItem__code">Pedido {o.publicCode}</strong>

                  <span className={`ordersStatus ordersStatus--${statusKey}`}>
                    {statusKey === "paid" ? "✅ " : statusKey === "failed" ? "⚠️ " : ""}
                    {paymentLabel}
                  </span>
                </div>

                {/* Meta grid */}
                <div className="ordersMeta">
                  <div className="ordersMeta__row">
                    <span>Fecha</span>
                    <b>{fmtDate(o.createdAt)}</b>
                  </div>

                  <div className="ordersMeta__row">
                    <span>Pago</span>
                    <b>{paymentLabel}</b>
                  </div>

                  {approvedAt ? (
                    <div className="ordersMeta__row">
                      <span>Aprobado</span>
                      <b>{approvedAt}</b>
                    </div>
                  ) : null}

                  {hasMpMethod ? (
                    <div className="ordersMeta__row">
                      <span>Método</span>
                      <b>{o.mp.method}</b>
                    </div>
                  ) : null}

                  <div className="ordersMeta__row">
                    <span>Envío</span>
                    <b>
                      {o.shippingQuote?.service ? `${o.shippingQuote.service} · ` : ""}
                      {shippingLabel}
                    </b>
                  </div>

                  <div className="ordersMeta__row">
                    <span>Tracking</span>
                    <b>{hasTracking ? o.trackingCode : "—"}</b>
                  </div>

                  {o.buyer?.shipping?.city ? (
                    <div className="ordersMeta__row">
                      <span>Destino</span>
                      <b>
                        {o.buyer.shipping.city}
                        {o.buyer.shipping.province ? `, ${o.buyer.shipping.province}` : ""}
                      </b>
                    </div>
                  ) : null}

                  <div className="ordersMeta__row">
                    <span>Ítems</span>
                    <b>{itemsCount}</b>
                  </div>

                  <div className="ordersMeta__row">
                    <span>Productos</span>
                    <b>{money(o.itemsTotal)}</b>
                  </div>

                  <div className="ordersMeta__row">
                    <span>Envío</span>
                    <b>{money(o.shippingTotal)}</b>
                  </div>

                  <div className="ordersMeta__row ordersMeta__row--total">
                    <span>Total</span>
                    <b>{money(o.total)}</b>
                  </div>
                </div>

                {/* Actions */}
                <div className="ordersActions">
                  <a className="ordersLink" href={`/pedido/${o.publicCode}`}>
                    Ver detalle
                  </a>

                  {hasTracking ? (
                    <button
                      type="button"
                      className="ordersBtn ordersBtn--ghost"
                      onClick={() => navigator.clipboard?.writeText(o.trackingCode)}
                      title="Copiar tracking"
                    >
                      📋 Copiar tracking
                    </button>
                  ) : null}

                  {canRetryPay  ? (
                    <div className="">
                      <button
                        type="button"
                        className="ordersLink"
                        onClick={onRetryPay}
                        disabled={retrying}
                      >
                        {retrying ? "Generando link de pago..." : "💳 Completar pago"}
                      </button>

                      {retryErr ? <p className="orderDetailPayErr">{retryErr}</p> : null}

                    </div>
                  ) : null}

                  {statusKey === "pending_review" ? (
                    <span className="ordersHint">
                      Estamos validando tu pago. Si ya pagaste, en unos minutos se actualiza.
                    </span>
                  ) : null}

                  {shippingLabel === "Despachado" && hasTracking ? (
                    <span className="ordersHint">
                      Usá el tracking para seguir el envío.
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="ordersBack">
          <a href="/">Volver al inicio</a>
        </p>

      </div>
    </main>

  );
}
