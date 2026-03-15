"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "./ProductCard";

export function FeaturedProduct() {
  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetch("/api/products").then(r => r.json()).then(({ products }) => {
      const p = products.find((x) => x.slug === "organizador-acrilico-1100");
      setProduct(p || null);
    });
  }, []);

  if (!product) return null;

  return (
    <section className="featuredProductContainer" id="1100ml">
      <h3 className="featuredProductContainer__title">La opción ideal para ordenar la cocina</h3>
      <h2 className="featuredProductContainer__badge">⭐ Más vendido</h2>
      <ProductCard product={product} />
    </section>
  );
}
