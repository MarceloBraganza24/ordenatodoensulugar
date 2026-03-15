"use client";

import { useEffect, useState,useRef } from "react";
import { useCart } from "@/context/CartContext";
import { ProductCard } from "./ProductCard";
import { formatARS } from "@/lib/money";
import Image from "next/image";

export function Packs() {
  const cart = useCart();
  const [packs, setPacks] = useState([]);
  const trackRef = useRef(null);
  const didInitScroll = useRef(false);
  const [active, setActive] = useState(0);

  const scrollToIndex = (idx, behavior = "smooth") => {
    const el = trackRef.current;
    if (!el) return;

    const target = el.children[idx];
    if (!target) return;

    // SOLO mueve el scroll horizontal del slider (no la página)
    const left = target.offsetLeft;
    el.scrollTo({ left, behavior });
  };

  const goTo = (idx) => {
    const clamped = Math.max(0, Math.min(idx, packs.length - 1));
    scrollToIndex(clamped);
    setActive(clamped);
  };

  const next = () => goTo(active + 1);
  const prev = () => goTo(active - 1);

  // Detectar cuál está “activa” según scroll
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onScroll = () => {
      const children = Array.from(el.children);
      const center = el.scrollLeft + el.clientWidth / 2;

      let bestIdx = 0;
      let bestDist = Infinity;

      children.forEach((child, idx) => {
        const childCenter = child.offsetLeft + child.clientWidth / 2;
        const dist = Math.abs(childCenter - center);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      });

      setActive(bestIdx);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    fetch("/api/products").then(r => r.json()).then(({ products }) => {
      setPacks(products.filter((x) => x.kind === "PACK"));
    });
  }, []);

  useEffect(() => {
    if (!packs.length) return;
    if (didInitScroll.current) return;

    didInitScroll.current = true;
    const startIndex = packs.length > 1 ? 1 : 0;

    requestAnimationFrame(() => {
      scrollToIndex(startIndex, "auto"); // 👈 clave
      setActive(startIndex);
    });
  }, [packs]);


  return (
    <section className="packsContainer" id="packs">
      <div className="packsHeader">
        <h2 className="packsContainer__title">Elegí el pack ideal para tu cocina</h2>
      </div>

      <div className="packsNav">
        <button
          type="button"
          className="packsNav__btn"
          onClick={prev}
          aria-label="Pack anterior"
        >
          ‹
        </button>

        <button
          type="button"
          className="packsNav__btn"
          onClick={next}
          aria-label="Siguiente pack"
        >
          ›
        </button>
      </div>

      <div ref={trackRef} className="packsSlider" aria-label="Slider de packs">
        {packs.map((p) => (
          <div key={p._id} className="packsSlide">
            <CardPacks product={p} cart={cart} />
          </div>
        ))}
      </div>

      <div className="packsDots" aria-label="Indicadores">
        {packs.map((p, idx) => (
          <button
            key={p.slug}
            type="button"
            className={`packsDots__dot ${idx === active ? "isActive" : ""}`}
            onClick={() => scrollToIndex(idx)}
            aria-label={`Ir al pack ${idx + 1}`}
          />
        ))}
      </div>

      <div className="packsContainer__productsAdjetives">
        <div className="packsContainer__productsAdjetives__productsAdjetive">
          <div className="packsContainer__productsAdjetives__productsAdjetive__itemi">👁️ Transparente</div>
          <div className="packsContainer__productsAdjetives__productsAdjetive__itemd">📦 Apilable</div>
        </div>
        <div className="packsContainer__productsAdjetives__productsAdjetive">
          <div className="packsContainer__productsAdjetives__productsAdjetive__itemi">🧼 Fácil limpieza</div>
          <div className="packsContainer__productsAdjetives__productsAdjetive__itemd">🧱 Resistente</div>
        </div>
      </div>
    </section>
  );
}



const CardPacks = ({ product, cart }) => {
  return (
   <article className={`cardPackContainer ${product.badge === "👍 Recomendado" ? "cardPackContainer--recommended" : ""}`}>
      {product.badge ? <div className="cardPackContainer__badge">{product.badge}</div> : null}

      <div className="cardPackContainer__img">
        <Image className="cardPackContainer__img__prop" src={product.imageUrl} alt={product.title} width={800} height={250} />
      </div>

      <h3 className="cardPackContainer__titleProduct">{product.title}</h3>
      <p className="cardPackContainer__description">{product.description}</p>
      <div className="cardPackContainer__price">{formatARS(product.price)}</div>

      {product.title == 'Pack Completo' ? (
        <p className="cardPackContainer__freeShipping">🚚 Este pack incluye envío gratis</p>
      ) : null}

      <p className="cardPackContainer__description">Hasta 3 cuotas sin interés con tarjeta.</p>

      {product.includedItems?.length ? (
        <ul className="cardPackContainer__benefits">
          {product.includedItems.map((x, idx) => (
            <li key={idx}>
              X{x.qty} {x.label}{x.ml ? ` (${x.ml} ml)` : ""}
            </li>
          ))}
        </ul>
      ) : null}

      {product.features?.length ? (
        <ul className="cardPackContainer__benefits">
          {product.features.map((f) => <li key={f}>{f}</li>)}
        </ul>
      ) : null}

      <div className="cardPackContainer__cta">
        <button className="cardPackContainer__cta__prop" type="button" onClick={() => cart.addItem(product, 1)}>AGREGAR AL CARRITO</button>
        <button className="cardPackContainer__cta__prop" type="button" onClick={() => { cart.addItem(product, 1); cart.open(); }}>COMPRAR</button>
      </div>
    </article>
  )
}

export default Packs