import { NextResponse } from "next/server";

const buckets = new Map();

function hit(ip, key, limit, windowMs) {
  const now = Date.now();
  const k = `${ip}:${key}`;
  const cur = buckets.get(k);

  if (!cur || now - cur.start > windowMs) {
    buckets.set(k, { start: now, count: 1 });
    return true;
  }
  cur.count += 1;
  return cur.count <= limit;
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // ✅ Solo proteger endpoints sensibles (POST)
  const isSensitive =
    pathname.startsWith("/api/admin/login") ||
    pathname.startsWith("/api/admin/webhooks/retry");

  if (!isSensitive) return NextResponse.next();

  // Solo rate-limit a POST (anti brute-force)
  if (req.method !== "POST") return NextResponse.next();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown";

  const ok = hit(ip, pathname, 15, 60_000); // 15/min
  if (!ok) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/admin/:path*"],
};
