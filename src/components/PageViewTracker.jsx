"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    // ❌ rutas que NO queremos contar
    const blockedPaths = [
      "/admin",
    ];

    if (blockedPaths.some((p) => pathname.startsWith(p))) return;

    // deduplicación simple por sesión + path
    const key = `pv_${pathname}`;

    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}

    fetch("/api/analytics/page-view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        path: pathname
      })
    }).catch(() => {});

  }, [pathname]);

  return null;
}