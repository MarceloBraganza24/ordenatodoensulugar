"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function NavbarSuccess() {
  const [open, setOpen] = useState(false);


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

  return (
    <>
      <header className={`navbarContainer ${open ? "navbarContainer--open" : ""}`}>
        <div className="navbarContainer__inner">
          <Link className="navbarContainer__brand" href="/">
            <img
              className="navbarContainer__logo"
              src="/img/logo_ordena_1000x400.webp"
              alt="ORDENA"
            />
          </Link>

        </div>
      </header>
    </>
  );
}
