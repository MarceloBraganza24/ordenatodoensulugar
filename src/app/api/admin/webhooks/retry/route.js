import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAdminGuard } from "@/lib/adminAuth";
import { mpPayment } from "@/lib/mp";

export async function POST(req) {
  const guard = requireAdminGuard(req);
  if (guard) return guard;

  const body = await req.json().catch(() => ({}));
  const paymentId = String(body.paymentId || "").trim();
  if (!paymentId) return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });

  await connectDB();

  // Re-procesás exactamente como el webhook:
  const payment = await mpPayment().get({ id: paymentId });
  return NextResponse.json({ ok: true, payment });
}
