"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function Navbar() {
  const cart = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [badgePop, setBadgePop] = useState(false);
  const prevCount = useRef(cart.count);

  useEffect(() => {
    // dispara solo si realmente cambió el count
    if (prevCount.current !== cart.count) {
      setBadgePop(true);
      const t = setTimeout(() => setBadgePop(false), 220);
      prevCount.current = cart.count;
      return () => clearTimeout(t);
    }
  }, [cart.count]);

  // cerrar con ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // bloquear scroll cuando el menú está abierto
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => (document.documentElement.style.overflow = "");
  }, [open]);

  const goHomeTop = (e) => {
    e.preventDefault();
    setOpen(false);

    if (pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      history.replaceState(null, "", "/");
      return;
    }

    router.push("/");
  };

  return (
    <>
      <header className={`navbarContainer ${open ? "navbarContainer--open" : ""}`}>
        <div className="navbarContainer__inner">
          <Link className="navbarContainer__brand" href="/" onClick={goHomeTop}>
            <img
              className="navbarContainer__logo"
              src="/img/logo_ordena_1000x400.webp"
              alt="ORDENA"
            />
          </Link>


          <div className="navbarContainer__actions">
            <button
              type="button"
              className={`navbarIconBtn ${cart.count ? "hasCount" : ""} ${badgePop ? "isPop" : ""}`}
              onClick={cart.open}
              aria-label="Abrir carrito"
            >
              <img className="navbarIconBtn__icon" src="/img/cart_black.png" alt="" />
              {cart.count ? <span className="navbarIconBtn__badge">{cart.count}</span> : null}
            </button>


            <button
                type="button"
                className={`navbarBurger ${open ? "isOpen" : ""}`}
                onClick={() => setOpen(v => !v)}
                aria-label="Abrir menú"
                aria-expanded={open}
                >
                <span />
                <span />
                <span />
            </button>

          </div>
        </div>
      </header>

      {/* Drawer */}
      <aside className={`navDrawer ${open ? "navDrawer--open" : ""}`} aria-hidden={!open}>
        <div className="navDrawer__backdrop" onClick={() => setOpen(false)} />

        <div className="navDrawer__panel" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="navDrawer__top">
            <div className="navDrawer__title">Menú</div>
            <button type="button" className="navDrawer__close" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <nav className="navDrawer__links">
            <Link onClick={() => setOpen(false)} href="/#packs">Packs</Link>
            <Link onClick={() => setOpen(false)} href="/#opiniones">Opiniones</Link>
            <Link onClick={() => setOpen(false)} href="/#faq">FAQ</Link>
            <Link onClick={() => setOpen(false)} href="/buscar">Buscar mi pedido</Link>
            <Link onClick={() => setOpen(false)} href="/mis-pedidos-online">Mis pedidos</Link>
          </nav>

          <div className="navDrawer__footer">
            <button type="button" className="navDrawer__cta" onClick={() => { setOpen(false); cart.open(); }}>
              Ver carrito
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
