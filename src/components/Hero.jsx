"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useCart } from "@/context/CartContext";
import Link from "next/link";

export function Hero() {
  const [product, setProduct] = useState(null);
  const cart = useCart();

  /* useEffect(() => {
    fetch("/api/products").then(r => r.json()).then(({ products }) => {
      const p = products.find((x) => x.slug === "organizador-acrilico-1100");
      setProduct(p || null);
    });
  }, []); */
  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      try {
        const response = await fetch("/api/products");

        if (!response.ok) {
          console.error("GET /api/products failed:", response.status);
          if (!cancelled) setProduct(null);
          return;
        }

        const text = await response.text();

        if (!text) {
          console.error("GET /api/products returned empty body");
          if (!cancelled) setProduct(null);
          return;
        }

        const data = JSON.parse(text);

        const p = data?.products?.find(
          (x) => x.slug === "organizador-acrilico-1100"
        );

        if (!cancelled) setProduct(p || null);
      } catch (error) {
        console.error("Hero products error:", error);
        if (!cancelled) setProduct(null);
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <div className="heroContainer">
        <h1 className="heroContainer__title">Organizadores de cocina</h1>
        <p className="heroContainer__subtitle">Ordená tu alacena y heladera en minutos</p>
        <h3 className="">Elegí tu pack y transformá tu cocina hoy</h3>
        <h3 className="">💰 Packs desde $17.999</h3>

        <div className="heroContainer__cta">
          <a href="#packs" className="heroContainer__cta__prop">
            VER PACKS RECOMENDADOS
          </a>
        </div>

        <p className="heroContainer__adverstingTape">
          📦 Envíos a todo el país - 💳 Mercado Pago <br />
          🚚 Despachamos en 24/48 hs <br />
          ENVÍO GRATIS desde $45.000
        </p>
          
      </div>

      <div className="heroContainer__img">
        <Image  className="heroContainer__img__prop" src="/img/contenedor-acrilico-1100ml.webp" alt="Contenedores herméticos para organizar alacena y cocina" width={340} height={300} />
      </div>
    </section>
  );
}
