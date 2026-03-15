"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./AdminOrders.module.scss";
import { formatARS } from "@/lib/money";
import { getProvinceName } from "@/lib/provinces";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminOrdersPage() {
  const router = useRouter();

  const [status, setStatus] = useState("");
  const [shippingStatus, setShippingStatus] = useState("");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [savingId, setSavingId] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");

    const me = await fetch("/api/auth/me");
    if (me.status === 401) {
      router.push("/admin/login");
      return;
    }

    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (shippingStatus) params.set("shippingStatus", shippingStatus);
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString() ? `?${params.toString()}` : "";

    const res = await fetch(`/api/admin/orders${qs}`);
    if (!res.ok) {
      setErr("No se pudieron cargar las órdenes");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [status, shippingStatus]);

  const totals = useMemo(() => {
    const totalOrders = orders.length;
    const totalPaid = orders.filter(o => o.status === "paid").length;
    const sumPaid = orders.filter(o => o.status === "paid").reduce((acc, o) => acc + (o.total || 0), 0);
    return { totalOrders, totalPaid, sumPaid };
  }, [orders]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const updateOrderLocal = (id, patch) => {
    setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, ...patch } : o)));
  };

  const saveOrder = async (id) => {
    const order = orders.find((o) => o._id === id);
    if (!order) return;

    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingStatus: order.shippingStatus,
          trackingCode: order.trackingCode || "",
          adminNotes: order.adminNotes || "",
        }),
      });

      if (!res.ok) {
        setErr("No se pudo guardar. Probá de nuevo.");
        setSavingId("");
        return;
      }

      const data = await res.json();
      if (data?.order) {
        updateOrderLocal(id, data.order);
      }
    } catch {
      setErr("No se pudo guardar. Probá de nuevo.");
    } finally {
      setSavingId("");
    }
  };

  

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Órdenes</h1>
          <p className={styles.subtitle}>Gestión de pagos, envío, tracking y notas internas.</p>
        </div>

        <div className={styles.headerRight}>
          <a className={styles.btn} href={`/api/admin/orders/export?status=${encodeURIComponent(status)}&shippingStatus=${encodeURIComponent(shippingStatus)}`}>
            Exportar CSV
          </a>
          <button type="button" className={styles.btn} onClick={()=>window.location.href = "/admin/analytics"}>
            Analytics
          </button>
          <button type="button" className={styles.btn} onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.filters}>
          <div className={styles.field}>
            <label className={styles.label}>Status pago</label>
            <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option>
              <option value="paid">Pagas</option>
              <option value="pending">Pendientes</option>
              <option value="failed">Fallidas</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Estado envío</label>
            <select className={styles.select} value={shippingStatus} onChange={(e) => setShippingStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="shipped">Enviado</option>
              <option value="delivered">Entregado</option>
            </select>
          </div>

          <div className={styles.search}>
            <div className={styles.field}>
              <label className={styles.label}>Búsqueda</label>
              <input
                className={styles.input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre / Tel / Email / Tracking"
              />
            </div>

            <div className={styles.searchActions}>
              <button type="button" className={styles.btnPrimary} onClick={load}>
                Buscar
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => {
                  setQ("");
                  load();
                }}
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        <div className={styles.kpis}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Total órdenes</div>
            <div className={styles.kpiValue}>{totals.totalOrders}</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Pagas</div>
            <div className={styles.kpiValue}>{totals.totalPaid}</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Monto pagas</div>
            <div className={styles.kpiValue}>
              {totals.sumPaid} <span className={styles.kpiUnit}>ARS</span>
            </div>
          </div>
        </div>

        {loading ? <p className={styles.notice}>Cargando…</p> : null}
        {err ? <p className={styles.error}>{err}</p> : null}
      </section>

      {orders.length === 0 && !loading ? <p className={styles.empty}>No hay órdenes.</p> : null}

      <div className={styles.list}>
        {orders.map((o) => {
          const shippingPrice =
            o.shippingTotal ??
            o.shippingData?.quote?.price ??
            o.shipping?.quote?.price ?? // compat órdenes viejas
            0;

          const itemsSubtotal =
            o.itemsTotal ??
            (o.items || []).reduce(
              (acc, it) => acc + (Number(it.qty || 0) * Number(it.unitPrice || 0)),
              0
            );

          const grandTotal =
            o.grandTotal ??
            o.total ??
            o.amount ??
            (Number(itemsSubtotal) + Number(shippingPrice));

          const addr = o?.buyer?.shippingAddress || {};

          const provinceName = getProvinceName(addr.province);

          const fullAddr = [
            addr.streetName,
            addr.streetNumber,
            addr.apt ? `Depto ${addr.apt}` : null,
          ].filter(Boolean).join(" ");

          return (
            <section key={o._id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h3 className={styles.cardTitle}>
                    Orden <span className={styles.mono}>#{String(o._id).slice(-6)}</span>
                  </h3>
                  <p className={styles.cardMeta}>Fecha: {formatDate(o.createdAt)}</p>
                </div>

                <div className={styles.badges}>
                  <span className={`${styles.badge} ${styles[`pay_${o.status}`] || ""}`}>
                    Pago: {o.status}
                  </span>
                  <span className={`${styles.badge} ${styles[`ship_${o.shippingStatus}`] || ""}`}>
                    Envío: {o.shippingStatus}
                  </span>
                </div>
              </div>

              <div className={styles.cardRow}>
                <div className={styles.totalBox}>
                  <div className={styles.totalLabel}>Subtotal</div>
                  <div className={styles.totalValue}>
                    {itemsSubtotal} <span className={styles.totalUnit}>{o.currency}</span>
                  </div>

                  <div className={styles.totalLabel} style={{ marginTop: 10 }}>Envío</div>
                  <div className={styles.totalValue}>
                    {shippingPrice} <span className={styles.totalUnit}>{o.currency}</span>
                  </div>

                  <div className={styles.totalLabel} style={{ marginTop: 10 }}>Total</div>
                  <div className={styles.totalValue}>
                    {formatARS(grandTotal)} <span className={styles.totalUnit}>{o.currency}</span>
                  </div>
                </div>

                <div className={styles.metaBox}>
                  <div className={styles.metaLine}>
                    <span className={styles.metaKey}>MP preference</span>
                    <span className={styles.mono}>{o.mp?.preferenceId || "-"}</span>
                  </div>
                  <div className={styles.metaLine}>
                    <span className={styles.metaKey}>MP payment</span>
                    <span className={styles.mono}>{o.mp?.paymentId || "-"}</span>
                  </div>
                </div>
              </div>

              <div className={styles.grid}>
                <div className={styles.block}>
                  <h4 className={styles.blockTitle}>Comprador</h4>
                  <div className={styles.info}>
                    <div><span className={styles.infoKey}>Nombre</span> {o.buyer?.name || "-"}</div>
                    <div><span className={styles.infoKey}>Tel</span> {o.buyer?.phone || "-"}</div>
                    <div><span className={styles.infoKey}>Email</span> {o.buyer?.email || "-"}</div>
                    <div style={{ marginTop: 8 }}>
                      <span className={styles.infoKey}>Envío</span>{" "}
                      {addr ? (
                        <div className={styles.muted}>

                          {fullAddr && (
                            <div>📍{fullAddr}</div>
                          )}

                          {(addr.city || addr.province) && (
                            <div>
                              📍{[addr.city, provinceName].filter(Boolean).join(", ")}
                              {addr.postalCode ? ` (${addr.postalCode})` : ""}
                            </div>
                          )}

                          {addr.postalCode && !addr.city && !addr.province && (
                            <div>📍 CP: {addr.postalCode}</div>
                          )}

                          {addr.dni && (
                            <div>🪪 DNI: {addr.dni}</div>
                          )}

                          {addr.notes && (
                            <div>📝 Obs: {addr.notes}</div>
                          )}

                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.block}>
                  <h4 className={styles.blockTitle}>Envío / tracking / notas</h4>

                  <div className={styles.form}>
                    <div className={styles.field}>
                      <label className={styles.label}>Estado envío</label>
                      <select
                        className={styles.select}
                        value={o.shippingStatus || "pending"}
                        onChange={(e) => updateOrderLocal(o._id, { shippingStatus: e.target.value })}
                      >
                        <option value="pending">Pendiente</option>
                        <option value="shipped">Enviado</option>
                        <option value="delivered">Entregado</option>
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Tracking</label>
                      <input
                        className={styles.input}
                        value={o.trackingCode || ""}
                        onChange={(e) => updateOrderLocal(o._id, { trackingCode: e.target.value })}
                        placeholder="Código de seguimiento"
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Notas internas</label>
                      <textarea
                        className={styles.textarea}
                        value={o.adminNotes || ""}
                        onChange={(e) => updateOrderLocal(o._id, { adminNotes: e.target.value })}
                        placeholder="Notas internas (no las ve el cliente)"
                      />
                    </div>

                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => saveOrder(o._id)}
                        disabled={savingId === o._id}
                      >
                        {savingId === o._id ? "Guardando..." : "Guardar cambios"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.items}>
                <h4 className={styles.blockTitle}>Items</h4>
                <ul className={styles.itemsList}>
                  {(o.items || []).map((it, idx) => (
                    <li key={idx} className={styles.item}>
                      <span className={styles.itemMain}>
                        <span className={styles.itemQty}>{it.qty}×</span> {it.title}
                      </span>
                      <span className={styles.itemMeta}>
                        {it.unitPrice} ARS · <span className={styles.mono}>slug: {it.slug}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )
        })}
      </div>
    </main>
  );
}
