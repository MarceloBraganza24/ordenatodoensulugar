import styles from "../OrdersPages.module.scss";
import { NavbarSuccess } from "@/components/NavbarSuccess";
import AdvertisingTape from "@/components/AdvertisingTape";

export default function PendingPage() {
  return (
    <>
    <AdvertisingTape />
    <NavbarSuccess />
    <main style={{padding:'50px 10px'}}>
    <h2 className={`${styles.titleFailure} ${styles.statePending}`}>Pago pendiente ⏳</h2>
      <p className={styles.subtitle}>Tu pago está en proceso. Si se acredita, preparamos el envío.</p>
      <a className={styles.link} href="/">
        Volver al inicio
      </a>
    </main>
    </>
  );
}
