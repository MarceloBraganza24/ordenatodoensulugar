"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getProvinceName } from "@/lib/provinces";
import { formatARS } from "@/lib/money";

function fmtDate(d) {
  try { return new Date(d).toLocaleString("es-AR"); } catch { return d; }
}

export default function PedidoDetallePage() {
  const router = useRouter();
  const { code } = useParams(); // ✅ no rompe con Next 16

  const [order, setOrder] = useState(null);
  const [msg, setMsg] = useState("Cargando...");
  
  // ✅ nuevo: estados para reintento pago
  const [retrying, setRetrying] = useState(false);
  const [retryErr, setRetryErr] = useState("");

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`/api/public/my-orders/${encodeURIComponent(code)}`);

      if (res.status === 401) {
        router.push("/buscar");
        return;
      }
      if (res.status === 404) {
        setMsg("No encontramos ese pedido para este email.");
        return;
      }
      if (!res.ok) {
        setMsg("No se pudo cargar el pedido.");
        return;
      }

      const data = await res.json();
      setOrder(data.order);
      setMsg("");
    };

    if (code) run();
  }, [code, router]);

  const onRetryPay = async () => {
    if (!order?.publicCode) return;

    setRetrying(true);
    setRetryErr("");

    try {
      const r = await fetch(`/api/public/my-orders/${encodeURIComponent(order.publicCode)}`, {
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

  if (msg) {
    return (
      <main className="orderDetailPage">

        <div className="orderDetailCard orderDetailCard--center">

          <h1 className="orderDetailTitle">
            Detalle del pedido
          </h1>

          <p className="orderDetailMessage">
            {msg}
          </p>

          <Link
            className="orderDetailBack"
            href="/mis-pedidos-online"
          >
            Volver
          </Link>

        </div>

      </main>

    );
  }

  const addr = order?.buyer?.shippingAddress || order?.buyer?.shipping || {};

  const provinceName = getProvinceName(addr.province);
  
  const itemsSubtotal =
    order?.itemsTotal ??
    (order?.items || []).reduce(
      (acc, it) => acc + (Number(it.qty || 0) * Number(it.unitPrice || 0)),
      0
    );

  const shippingPrice =
    order?.shippingTotal ??
    order?.shippingData?.quote?.price ??
    order?.shipping?.quote?.price ??
    0;

  const grandTotal = order?.total ?? (itemsSubtotal + shippingPrice);

  const shipService =
    order?.shippingData?.quote?.service ||
    order?.shippingQuote?.service ||
    order?.shipping?.quote?.service ||
    "";

  const canRetryPay = order?.canRetryPay;

  return (
    <main className="orderDetailPage">

      <div className="orderDetailCard">

        <h1 className="orderDetailTitle">
          Detalle del pedido {order.publicCode}
        </h1>

        <div className="orderDetailStatus">
          <p><span>Fecha</span><b>{fmtDate(order.createdAt)}</b></p>
          <p><span>Pago</span><b>{order.status}</b></p>
          <p><span>Envío</span><b>{order.shippingStatus}</b></p>
          <p><span>Tracking</span><b>{order.trackingCode || "-"}</b></p>
        </div>

        {/* ✅ nuevo: botón reintentar pago si quedó pendiente */}
        {canRetryPay ? (
          <div className="orderDetailPayBox">
            <button
              type="button"
              className="orderDetailPayBtn"
              onClick={onRetryPay}
              disabled={retrying}
            >
              {retrying ? "Generando link de pago..." : "💳 Completar pago"}
            </button>

            {retryErr ? <p className="orderDetailPayErr">{retryErr}</p> : null}

            <p className="orderDetailPayHint">
              Si cerraste Mercado Pago sin pagar, podés reintentar desde acá.
            </p>
          </div>
        ) : null}

        <h2 className="orderDetailSectionTitle">Datos del comprador</h2>

        <div className="orderDetailBuyer">
          <p><span>Nombre</span><b>{order.buyer?.name || "-"}</b></p>
          <p><span>Teléfono</span><b>{order.buyer?.phone || "-"}</b></p>
          <p><span>Email</span><b>{order.buyer?.email || "-"}</b></p>
        </div>

        <h2 className="orderDetailSectionTitle">Dirección de envío</h2>

        <div className="orderDetailBuyer">
          {addr.streetName ? (
            <p>
              <span>Dirección</span>
              <b>
                {addr.streetName} {addr.streetNumber}
                {addr.apt ? `, ${addr.apt}` : ""}
              </b>
            </p>
          ) : null}

          {addr.city ? (
            <p>
              <span>Ciudad</span>
              <b>
                {addr.city}
                {addr.province ? `, ${provinceName}` : ""}
              </b>
            </p>
          ) : null}

          {addr.postalCode ? (
            <p>
              <span>CP</span>
              <b>{addr.postalCode}</b>
            </p>
          ) : null}
        </div>

        <h2 className="orderDetailSectionTitle">Productos</h2>

        <ul className="orderDetailItems">
          {(order.items || []).map((it, idx) => (
            <li className="orderDetailItem" key={idx}>
              <span>{it.qty} × {it.title}</span>
              <b>{formatARS(it.unitPrice)} ARS</b>
            </li>
          ))}
        </ul>

        <div className="orderDetailTotals">

          <div className="orderDetailTotalRow">
            <span>Productos:</span>
            <b> {formatARS(itemsSubtotal)} {order.currency}</b>
          </div>

          <div className="orderDetailTotalRow">
            <span>Envío {shipService ? `(${shipService})` : ""}:</span>
            <b> {formatARS(shippingPrice)} {order.currency}</b>
          </div>

          <div className="orderDetailTotalRow orderDetailTotalRow--final">
            <span>Total:</span>
            <b> {formatARS(grandTotal)} {order.currency}</b>
          </div>

        </div>

        <Link
          className="orderDetailBack"
          href="/mis-pedidos-online"
        >
          Volver a mis pedidos
        </Link>

      </div>

    </main>

  );
}
