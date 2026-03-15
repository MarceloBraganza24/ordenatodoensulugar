import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";

/**
 * Valida un secret para permitir cron sin cookies.
 * Usar header: x-cron-secret: <CRON_SECRET>
 * (alternativa) Authorization: Bearer <CRON_SECRET>
 */
function requireCronSecret(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Missing CRON_SECRET" },
      { status: 500 }
    );
  }

  const h1 = String(req.headers.get("x-cron-secret") || "").trim();
  const auth = String(req.headers.get("authorization") || "").trim();
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";

  if (h1 !== secret && bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function safeInt(v, def) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

export async function POST(req) {
  const guard = requireCronSecret(req);
  if (guard) return guard;

  const url = new URL(req.url);

  // defaults
  const hours = safeInt(url.searchParams.get("hours"), 24);
  const includeReview = String(url.searchParams.get("includeReview") || "1") !== "0";

  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  await connectDB();

  const statuses = includeReview ? ["pending", "pending_review"] : ["pending"];

  const result = await Order.updateMany(
    {
      status: { $in: statuses },
      createdAt: { $lt: cutoff },
    },
    {
      $set: { status: "failed" }, // si querés diferenciar, podemos usar "expired"
      $push: {
        adminNotes: {
          $each: [
            `[AUTO] Expirada por falta de pago (${hours}h). ${new Date().toISOString()}`,
          ],
          $slice: -20,
        },
      },
    }
  );

  return NextResponse.json({
    ok: true,
    hours,
    includeReview,
    cutoff: cutoff.toISOString(),
    matched: result.matchedCount ?? result.n ?? 0,
    modified: result.modifiedCount ?? result.nModified ?? 0,
  });
}