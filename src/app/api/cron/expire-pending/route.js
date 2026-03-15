// app/api/cron/expire-pending/route.js
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";

function requireCronSecret(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "Missing CRON_SECRET" }, { status: 500 });
  }

  const got = req.headers.get("x-cron-secret") || "";
  if (got !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function GET(req) {
  const guard = requireCronSecret(req);
  if (guard) return guard;

  await connectDB();

  // 24 horas atrás
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Expirar SOLO órdenes pending "viejas"
  // (no tocamos paid / refunded / etc)
  const q = {
    status: "pending",
    createdAt: { $lt: cutoff },
  };

  const update = {
    $set: {
      status: "failed", // o "expired" si quisieras agregar un enum nuevo
    },
    $push: {
      adminNotes: `Auto-expirada por cron (${new Date().toISOString()})`,
    },
  };

  const r = await Order.updateMany(q, update);

  return NextResponse.json({
    ok: true,
    cutoff: cutoff.toISOString(),
    matched: r.matchedCount ?? r.n ?? 0,
    modified: r.modifiedCount ?? r.nModified ?? 0,
  });
}