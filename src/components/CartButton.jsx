"use client";

import { useCart } from "@/context/CartContext";
import { formatARS } from "@/lib/money";

export function CartButton() {
  const cart = useCart();

  return (
    <button type="button" onClick={cart.open}>
      Carrito ({cart.count}) – {formatARS(cart.total)}
    </button>
  );
}
