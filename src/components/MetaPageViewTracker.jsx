"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { fbq } from "@/lib/meta/pixel";

export default function MetaPageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    // ❌ rutas que no queremos enviar a Meta
    const blockedPaths = [
      "/admin",
    ];

    if (blockedPaths.some((p) => pathname.startsWith(p))) return;

    // deduplicación por sesión + path
    const key = `meta_pv_${pathname}`;

    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}

    fbq("track", "PageView");

  }, [pathname]);

  return null;
}