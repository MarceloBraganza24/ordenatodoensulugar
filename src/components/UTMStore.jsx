"use client";
import { useEffect } from "react";

export default function UTMStore() {
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const keys = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"];

    keys.forEach((k) => {
      const v = qs.get(k);
      if (v) sessionStorage.setItem(k, v);
    });
  }, []);

  return null;
}
