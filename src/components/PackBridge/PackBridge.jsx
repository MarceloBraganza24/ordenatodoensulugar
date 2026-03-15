"use client";

import styles from "./PackBridge.module.scss";

export default function PackBridge({ targetId = "packs" }) {
  const onGo = () => {
    const el = document.getElementById(targetId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className={styles.wrap} aria-label="Upsell packs">
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.badge}>🔥</span>
          <h2 className={styles.title}>¿Querés ordenar toda tu cocina?</h2>
        </div>

        
        <p className={styles.sub}>
          Con el pack completo tenés todos los tamaños y <strong>ahorrás más</strong>.
        </p>

        <ul className={styles.list}>
          <li>✔ Harinas</li>
          <li>✔ Pastas</li>
          <li>✔ Cereales</li>
          <li>✔ Snacks</li>
          <li>✔ Legumbres</li>
        </ul>

        <p className={styles.sub}>
          🚚 Envío gratis desde $45.000
        </p>

        <button type="button" className={styles.cta} onClick={onGo}>
          👉 Ver packs recomendados
        </button>
      </div>
    </section>
  );
}
