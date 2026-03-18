/* "use client";
import { track } from "@/lib/meta/pixel";
import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";

const CartContext = createContext(null);

function calcTotals(items) {
  const count = items.reduce((acc, it) => acc + it.qty, 0);
  const total = items.reduce((acc, it) => acc + it.qty * it.price, 0);
  return { count, total };
}

function reducer(state, action) {
  switch (action.type) {
    case "SET":
      return { ...state, items: action.items || [] };

    case "ADD": {
      const { product, qty } = action;
      const existing = state.items.find((x) => x.slug === product.slug);
      let next = [];

      if (existing) {
        next = state.items.map((x) =>
          x.slug === product.slug ? { ...x, qty: x.qty + qty } : x
        );
      } else {
        next = [...state.items, { slug: product.slug, title: product.title, price: product.price, qty }];
      }
      return { ...state, items: next };
    }

    case "REMOVE": {
      const slug = action.slug;
      return { ...state, items: state.items.filter((x) => x.slug !== slug) };
    }

    case "INC": {
      const slug = action.slug;
      return { ...state, items: state.items.map((x) => (x.slug === slug ? { ...x, qty: x.qty + 1 } : x)) };
    }

    case "DEC": {
      const slug = action.slug;
      const next = state.items
        .map((x) => (x.slug === slug ? { ...x, qty: Math.max(1, x.qty - 1) } : x));
      return { ...state, items: next };
    }

    case "CLEAR":
      return { ...state, items: [] };

    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });
  const [isOpen, setIsOpen] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cart_v1");
      if (raw) dispatch({ type: "SET", items: JSON.parse(raw) });
    } catch {}
  }, []);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem("cart_v1", JSON.stringify(state.items));
    } catch {}
  }, [state.items]);

  const totals = useMemo(() => calcTotals(state.items), [state.items]);

  const api = useMemo(() => ({
    items: state.items,
    count: totals.count,
    total: totals.total,
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),

    addItem: (product, qty = 1) => {
      try {
        track("AddToCart", {
          content_name: product?.title || "",
          content_ids: [product?.slug || product?._id || product?.title || ""],
          content_type: "product",
          value: Number(product?.price || 0) * Number(qty || 1),
          currency: "ARS",
        });
      } catch {}

      dispatch({ type: "ADD", product, qty });
    },
    removeItem: (slug) => dispatch({ type: "REMOVE", slug }),
    inc: (slug) => dispatch({ type: "INC", slug }),
    dec: (slug) => dispatch({ type: "DEC", slug }),
    clear: () => {
      try { localStorage.removeItem("cart_v1"); } catch {}
      dispatch({ type: "CLEAR" });
      setIsOpen(false);
    },
  //}), [state.items, totals, isOpen]);
  }), [state.items, totals.count, totals.total, isOpen]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
 */

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { track } from "@/lib/meta/pixel";

const CartContext = createContext(null);

const CART_STORAGE_KEY = "cart_v1";

function calcTotals(items) {
  const count = items.reduce((acc, it) => acc + Number(it.qty || 0), 0);
  const total = items.reduce(
    (acc, it) => acc + Number(it.qty || 0) * Number(it.price || 0),
    0
  );
  return { count, total };
}

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .filter((it) => it && typeof it.slug === "string")
    .map((it) => ({
      slug: String(it.slug || ""),
      title: String(it.title || ""),
      price: Number(it.price || 0),
      qty: Math.max(1, Number(it.qty || 1)),
    }))
    .filter((it) => !!it.slug);
}

function reducer(state, action) {
  switch (action.type) {
    case "SET":
      return { ...state, items: sanitizeItems(action.items) };

    case "ADD": {
      const { product, qty } = action;
      const safeQty = Math.max(1, Number(qty || 1));

      const existing = state.items.find((x) => x.slug === product.slug);
      let next = [];

      if (existing) {
        next = state.items.map((x) =>
          x.slug === product.slug ? { ...x, qty: x.qty + safeQty } : x
        );
      } else {
        next = [
          ...state.items,
          {
            slug: product.slug,
            title: product.title,
            price: Number(product.price || 0),
            qty: safeQty,
          },
        ];
      }

      return { ...state, items: next };
    }

    case "REMOVE": {
      return {
        ...state,
        items: state.items.filter((x) => x.slug !== action.slug),
      };
    }

    case "INC": {
      return {
        ...state,
        items: state.items.map((x) =>
          x.slug === action.slug ? { ...x, qty: x.qty + 1 } : x
        ),
      };
    }

    case "DEC": {
      return {
        ...state,
        items: state.items.map((x) =>
          x.slug === action.slug ? { ...x, qty: Math.max(1, x.qty - 1) } : x
        ),
      };
    }

    case "CLEAR":
      return { ...state, items: [] };

    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        dispatch({ type: "SET", items: parsed });
      }
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist only after hydration
  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // ignore
    }
  }, [state.items, hydrated]);

  const totals = useMemo(() => calcTotals(state.items), [state.items]);

  const api = useMemo(
    () => ({
      items: state.items,
      count: totals.count,
      total: totals.total,
      isOpen,
      hydrated,

      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((prev) => !prev),

      addItem: (product, qty = 1) => {
        try {
          track("AddToCart", {
            content_name: product?.title || "",
            content_ids: [product?.slug || product?._id || product?.title || ""],
            content_type: "product",
            value: Number(product?.price || 0) * Number(qty || 1),
            currency: "ARS",
          });
        } catch {
          // ignore
        }

        dispatch({ type: "ADD", product, qty });
      },

      removeItem: (slug) => dispatch({ type: "REMOVE", slug }),
      inc: (slug) => dispatch({ type: "INC", slug }),
      dec: (slug) => dispatch({ type: "DEC", slug }),

      clear: () => {
        try {
          localStorage.removeItem(CART_STORAGE_KEY);
        } catch {
          // ignore
        }

        dispatch({ type: "CLEAR" });
        setIsOpen(false);
      },
    }),
    [state.items, totals.count, totals.total, isOpen, hydrated]
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}