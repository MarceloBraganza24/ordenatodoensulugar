"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./AdminAnalytics.module.scss";

function fmtMoney(n) {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(n || 0);
  } catch {
    return `${n} ARS`;
  }
}

function pct(x) {
  if (!isFinite(x)) return "0%";
  return `${(x * 100).toFixed(1)}%`;
}

export default function AdminAnalyticsPage() {
  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState(null);
  const [utm, setUtm] = useState(null);

  const [msg, setMsg] = useState("Cargando...");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const s = q.toString();
    return s ? `?${s}` : "";
  }, [from, to]);

  const urls = useMemo(() => {
    return {
      overview: `/api/admin/analytics/overview${qs}`,
      products: `/api/admin/analytics/products${qs}`,
      utm: `/api/admin/analytics/utm${qs}`,
    };
  }, [qs]);

  useEffect(() => {
    const run = async () => {
      setMsg("Cargando...");
      setOverview(null);
      setProducts(null);
      setUtm(null);

      try {
        const [r1, r2, r3] = await Promise.all([
          fetch(urls.overview),
          fetch(urls.products),
          fetch(urls.utm),
        ]);

        if (!r1.ok) throw new Error("No se pudo cargar overview.");
        if (!r2.ok) throw new Error("No se pudo cargar products.");
        if (!r3.ok) throw new Error("No se pudo cargar utm.");

        const [j1, j2, j3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
        setOverview(j1);
        setProducts(j2);
        setUtm(j3);
        setMsg("");
      } catch (e) {
        setMsg(e?.message || "No se pudo cargar analytics.");
      }
    };

    run();
  }, [urls]);

  if (msg) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Analytics</h1>
            <p className={styles.sub}>Resumen + embudo + top productos + campañas.</p>
          </div>
        </header>
        <p className={styles.notice}>{msg}</p>
      </main>
    );
  }

  const t = overview?.totals || {};
  const c = overview?.conversion || {};
  const days = overview?.days || [];

  const topByRevenue = products?.topByRevenue || [];
  const topByQty = products?.topByQty || [];
  const utmRows = utm?.rows || [];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Analytics</h1>
          <p className={styles.sub}>
            Mostrando: <strong>{overview?.from}</strong> → <strong>{overview?.to}</strong>
          </p>
        </div>

        <div className={styles.headerActions}>
          <a className={styles.link} href="/admin/orders">Órdenes</a>
        </div>
      </header>

      <section className={styles.panel}>
        <h2 className={styles.h2}>Rango</h2>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Desde</label>
            <input className={styles.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Hasta</label>
            <input className={styles.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Reset
          </button>
        </div>

        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Ventas (paid)</div>
            <div className={styles.kpiValue}>{t.ordersPaid || 0}</div>
          </div>

          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Facturación (paid)</div>
            <div className={styles.kpiValue}>{fmtMoney(t.revenuePaid || 0)}</div>
          </div>

          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Acreditado (net)</div>
            <div className={styles.kpiValue}>{fmtMoney(t.netPaid || 0)}</div>
          </div>

          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Comisiones MP</div>
            <div className={styles.kpiValue}>{fmtMoney(t.feesPaid || 0)}</div>
          </div>

          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Ticket promedio</div>
            <div className={styles.kpiValue}>{fmtMoney(c.aov || 0)}</div>
          </div>

          <div className={styles.kpi}>
            <div className={styles.kpiLabel}>Landing → Paid</div>
            <div className={styles.kpiValue}>{pct(c.landing_to_paid || 0)}</div>
          </div>
        </div>
      </section>

      <section className={styles.grid2}>
        <div className={styles.card}>
          <h2 className={styles.h2}>Embudo</h2>
          <ul className={styles.list}>
            <li>Page views: <strong>{t.page_view || 0}</strong></li>
            <li>View item: <strong>{t.view_item || 0}</strong></li>
            <li>
              Add to cart: <strong>{t.add_to_cart || 0}</strong> <span className={styles.muted}>(conv {pct(c.landing_to_cart || 0)})</span>
            </li>
            <li>
              Begin checkout: <strong>{t.begin_checkout || 0}</strong> <span className={styles.muted}>(conv {pct(c.cart_to_checkout || 0)})</span>
            </li>
            <li>Redirect MP: <strong>{t.redirect_to_mp || 0}</strong></li>
            <li>
              Paid: <strong>{t.ordersPaid || 0}</strong> <span className={styles.muted}>(conv {pct(c.checkout_to_paid || 0)})</span>
            </li>
          </ul>
        </div>

        <div className={styles.card}>
          <h2 className={styles.h2}>Top campañas (source/campaign)</h2>

          {utmRows.length === 0 ? (
            <p className={styles.notice}>Aún no hay revenue por UTM en este rango.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Campaign</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {utmRows.map((r) => (
                  <tr key={r.key}>
                    <td className={styles.mono}>{r.source}</td>
                    <td className={styles.mono}>{r.campaign}</td>
                    <td>{fmtMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className={styles.grid2}>
        <div className={styles.card}>
          <h2 className={styles.h2}>Top productos por ingresos</h2>

          {topByRevenue.length === 0 ? (
            <p className={styles.notice}>Aún no hay datos de productos en este rango.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Slug</th>
                  <th>Qty</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topByRevenue.map((r) => (
                  <tr key={r.slug}>
                    <td className={styles.mono}>{r.slug}</td>
                    <td>{r.qty}</td>
                    <td>{fmtMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.card}>
          <h2 className={styles.h2}>Top productos por cantidad</h2>

          {topByQty.length === 0 ? (
            <p className={styles.notice}>Aún no hay datos de productos en este rango.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Slug</th>
                  <th>Qty</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topByQty.map((r) => (
                  <tr key={r.slug}>
                    <td className={styles.mono}>{r.slug}</td>
                    <td>{r.qty}</td>
                    <td>{fmtMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Serie diaria</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Día</th>
              <th>PV</th>
              <th>ATC</th>
              <th>Checkout</th>
              <th>Paid</th>
              <th>Revenue</th>
              <th>Net</th>
              <th>Fees</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <td className={styles.mono}>{d.day}</td>
                <td>{d.page_view}</td>
                <td>{d.add_to_cart}</td>
                <td>{d.begin_checkout}</td>
                <td>{d.ordersPaid}</td>
                <td>{fmtMoney(d.revenuePaid)}</td>
                <td>{fmtMoney(d.netPaid || 0)}</td>
                <td>{fmtMoney(d.feesPaid || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className={styles.footer}>
        <a className={styles.link} href="/admin/orders">Volver a órdenes</a>
      </footer>
    </main>
  );
}
