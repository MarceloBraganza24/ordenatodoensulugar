"use client";

import styles from "../OrdersPages.module.scss";
import { NavbarSuccess } from "@/components/NavbarSuccess";
import AdvertisingTape from "@/components/AdvertisingTape";

export default function FailurePage() {
  return (
    <>
    <AdvertisingTape />
    <NavbarSuccess />
    <main style={{padding:'50px 10px'}}>
      <h2 className={`${styles.titleFailure} ${styles.stateFail}`}>Pago rechazado ❌</h2>
      <p className={styles.subtitle}>No se pudo completar el pago. Podés intentar nuevamente cuando quieras.</p>
      <a className={styles.link} href="/">
        Volver al inicio
      </a>
    </main>
    </>
  );
}
