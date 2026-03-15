import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { z } from "zod";

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // ✅ normalizamos lo que viene del form
  const username = String(parsed.data.username || "").trim();
  const password = String(parsed.data.password || "").trim();

  // ✅ normalizamos envs (secret manager suele traer \n al final)
  const u = String(process.env.ADMIN_USERNAME || "").trim();
  const p = String(process.env.ADMIN_PASSWORD || "").trim();
  const secret = String(process.env.JWT_SECRET || "").trim();

  // Debug seguro (no imprime secretos)
  console.log("[admin-login] env lengths:", {
    uLen: u.length,
    pLen: p.length,
    secretLen: secret.length,
  });

  if (!u || !p || !secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (username !== u || password !== p) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const token = jwt.sign({ sub: "admin", role: "admin" }, secret, { expiresIn: "7d" });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}


/* import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { z } from "zod";

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req) {
  const body = await req.json();
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const { username, password } = parsed.data;

  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  const secret = process.env.JWT_SECRET;

  if (!u || !p || !secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (username !== u || password !== p) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const token = jwt.sign(
    { sub: "admin", role: "admin" },
    secret,
    { expiresIn: "7d" }
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });

  return res;
}
 */