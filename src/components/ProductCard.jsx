"use client";

import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { formatARS } from "@/lib/money";

export function ProductCard({ product }) {
  const cart = useCart();

  return (
    <article className={`featuredProductContainer ${product.badge === "👍 Recomendado" ? "featuredProductContainer--recommended" : ""}`}>
      
      <div className="featuredProductContainer__img">
        <Image 
          className="featuredProductContainer__img__prop" 
          src={product.imageUrl} 
          alt="Contenedor hermético acrílico 1100 ml para organizar cocina y alacena"
          width={800} 
          height={250} 
        />
      </div>

      {product.badge ? (
        <div className="featuredProductContainer__productBadge">{product.badge}</div>
      ) : null}

      <h3 className="featuredProductContainer__titleProduct">
        {product.title}
      </h3>

      <p className="featuredProductContainer__description">
        {product.description}
      </p>

      <div className="featuredProductContainer__price">
        {formatARS(product.price)} ARS
      </div>

      <p className="featuredProductContainer__underPrice">
        Hasta 3 cuotas sin interés con tarjeta.
      </p>

      <p className="featuredProductContainer__shippingInfo">
        🚚 Envíos a todo el país · Se calcula antes de pagar
      </p>

      <div className="featuredProductContainer__benefits">
        <div>✔ Transparente: ves todo de un vistazo</div>
        <div>✔ Apilable: ahorrás espacio</div>
        <div>✔ Hermético: conserva mejor arroz, pastas y cereales</div>
        <div>✔ Fácil limpieza</div>
      </div>

      {/* 🔥 BLOQUE AUMENTO DE TICKET */}
      <div className="featuredProductContainer__upsellBox">
        <div className="featuredProductContainer__upsellLine">
          🔥 Llevando 2 ahorrás envío
        </div>
        <div className="featuredProductContainer__upsellLine">
          🔥 Pack recomendado con mejor precio por unidad
        </div>

        <button
          type="button"
          className="featuredProductContainer__viewPackBtn"
          onClick={() => {
            const el = document.getElementById("packs");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          👉 Ver packs recomendados
        </button>
      </div>

      <div className="featuredProductContainer__cta">
        <button
          className="featuredProductContainer__cta__prop"
          type="button"
          onClick={() => {
            cart.addItem(product, 1);
            cart.open();
          }}
        >
          COMPRAR
        </button>
      </div>

      <div className="featuredProductContainer__microCopy">
        ¿Querés ordenar toda tu cocina de una vez? Mirá los packs con descuento.
      </div>

      <div className="featuredProductContainer__advertisingTape">
        Stock propio · Envíos a todo el país · Mercado Pago
      </div>

    </article>

  );
}
