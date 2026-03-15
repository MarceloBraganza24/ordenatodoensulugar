import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_ADMIN_PATHS = ["/admin/login"];

function isAllowedAdminPage(pathname) {
  return PUBLIC_ADMIN_PATHS.includes(pathname);
}

function isAuthApi(pathname) {
  return pathname.startsWith("/api/auth");
}

/* ---------------- Rate limit (simple, in-memory) ----------------
   - Fixed window buckets
   - Separate limits for:
     - /api/auth/login  (brute-force)
     - /api/admin/*     (admin API)
------------------------------------------------------------------ */
const WINDOW_MS = 60_000; // 1 min

const LIMITS = {
  LOGIN: 10, // 10 req/min
  ADMIN: 60, // 60 req/min
};

const buckets = new Map();

function getClientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xrip = req.headers.get("x-real-ip");
  if (xrip) return xrip.trim();
  return "unknown";
}

function cleanupOldBuckets(now) {
  for (const [k, v] of buckets.entries()) {
    if (now - v.resetAt > WINDOW_MS * 2) buckets.delete(k);
  }
}

function rateLimit(req, key, maxReq) {
  const now = Date.now();
  cleanupOldBuckets(now);

  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: maxReq - 1, resetAt: now + WINDOW_MS, limit: maxReq };
  }

  entry.count += 1;
  buckets.set(key, entry);

  const remaining = Math.max(0, maxReq - entry.count);
  const allowed = entry.count <= maxReq;
  return { allowed, remaining, resetAt: entry.resetAt, limit: maxReq };
}

/* ---------------- JWT verify (Edge) ---------------- */
async function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key); // HS256
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isLoginApi = pathname === "/api/auth/login";

  // --------- RATE LIMIT ----------
  // 1) Login brute-force protection
  if (isLoginApi) {
    const ip = getClientIp(req);
    const key = `login:${ip}`;
    const rl = rateLimit(req, key, LIMITS.LOGIN);

    if (!rl.allowed) {
      const res = NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
      res.headers.set("Retry-After", String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
      res.headers.set("X-RateLimit-Limit", String(rl.limit));
      res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
      res.headers.set("X-RateLimit-Reset", String(rl.resetAt));
      return res;
    }
  }

  // 2) Admin API rate limit
  if (isAdminApi) {
    const ip = getClientIp(req);
    const key = `admin_api:${ip}`;
    const rl = rateLimit(req, key, LIMITS.ADMIN);

    if (!rl.allowed) {
      const res = NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
      res.headers.set("Retry-After", String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
      res.headers.set("X-RateLimit-Limit", String(rl.limit));
      res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
      res.headers.set("X-RateLimit-Reset", String(rl.resetAt));
      return res;
    }
  }
  // -------------------------------

  // No tocar otras rutas
  if (!isAdminPage && !isAdminApi && !isAuthApi(pathname)) return NextResponse.next();

  // Permitir login page y resto de /api/auth
  if (isAdminPage && isAllowedAdminPage(pathname)) return NextResponse.next();
  if (isAuthApi(pathname)) return NextResponse.next();

  // Proteger admin page + admin api con JWT
  const token = req.cookies.get("admin_token")?.value;

  if (!token) {
    if (isAdminApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const payload = await verifyToken(token);

  if (!payload || payload.role !== "admin") {
    if (isAdminApi) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      res.cookies.set("admin_token", "", { path: "/", maxAge: 0 });
      return res;
    }

    const res = NextResponse.redirect(new URL("/admin/login", req.url));
    res.cookies.set("admin_token", "", { path: "/", maxAge: 0 });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/auth/:path*"],
};
