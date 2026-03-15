"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/context/CartContext";
import { ProductCard } from "./ProductCard";
import Image from "next/image";

export function Upsell() {
  const [upsell, setUpsell] = useState(null);

  useEffect(() => {
    fetch("/api/products").then(r => r.json()).then(({ products }) => {
      const u = products.find((x) => x.kind === "UPSELL");
      setUpsell(u || null);
    });
  }, []);

  if (!upsell) return null;

  return (
    <section className="upsellProductContainer" id="upsell">
      <h2 className="upsellProductContainer__title">Complementá tu cocina</h2>
      <div className="upsellProductContainer__badge">Producto premium</div>
      <UpsellProduct product={upsell}/>
    </section>
  );
}

const UpsellProduct = ({product}) => {
  const cart = useCart();
  return (
    <article className="upsellProductContainer">
      <div className="upsellProductContainer__img">
        <Image className="upsellProductContainer__img__prop" src="/img/cubertero-bamboo.png" width={800} height={250} alt="cubertero bamboo" />
      </div>


      <h3 className="upsellProductContainer__titleProduct">Cubiertero 5 Divisiones 37x30cm Bambú</h3>
      <div className="upsellProductContainer__price">$32.999 ARS</div>
      <div className="upsellProductContainer__underPrice">Hasta 3 cuotas sin interés con tarjeta.</div>

      <div className="featuredProductContainer__benefits">
        <div>✔ Madera natural resistente</div>
        <div>✔ 5 divisiones amplias y cómodas</div>
        <div>✔ Se adapta a la mayoría de cajones estándar</div>
        <div>✔ Diseño minimalista que eleva tu cocina</div>
        <div>✔ Fácil limpieza y larga durabilidad</div>
      </div>

      <div className="upsellProductContainer__cta">
        <button className="upsellProductContainer__cta__prop" type="button" onClick={() => cart.addItem(product, 1)}>AGREGAR AL CARRITO</button>
        <button className="upsellProductContainer__cta__prop" type="button" onClick={() => { cart.addItem(product, 1); cart.open(); }}>COMPRAR</button>
      </div>

      <div className="upsellProductContainer__benefits">
        <div className="upsellProductContainer__benefits__item">🚚 Envíos a todo el país</div>
        <div className="upsellProductContainer__benefits__item">💳 Mercado Pago</div>
        <div className="upsellProductContainer__benefits__item">📦 Stock propio</div>
        <div className="upsellProductContainer__benefits__item">🔒 Compra segura</div>
      </div>
    </article>
  )
}