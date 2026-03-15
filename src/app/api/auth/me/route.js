import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(req) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const token = req.cookies.get("admin_token")?.value;
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const decoded = jwt.verify(token, secret);
    return NextResponse.json({ ok: true, user: decoded });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
