import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export function requireAdminGuard(req) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Missing JWT_SECRET" }, { status: 500 });
  }

  const token = req.cookies.get("admin_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    jwt.verify(token, secret);
    return null; // ✅ ok
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
