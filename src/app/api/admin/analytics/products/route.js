import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { DailyMetric } from "@/models/DailyMetric";
import { requireAdminGuard } from "@/lib/adminAuth";

function parseDay(s) {
  if (!s || typeof s !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function toPlainObject(m) {
  if (!m) return {};
  if (typeof m.get === "function" && typeof m.entries === "function") {
    const out = {};
    for (const [k, v] of m.entries()) out[String(k)] = v;
    return out;
  }
  if (typeof m === "object") return m; // lean suele devolver plain object
  return {};
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function utcDayString(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req) {
  const guard = requireAdminGuard(req);
  if (guard) return guard;

  const url = new URL(req.url);
  const from = parseDay(url.searchParams.get("from"));
  const to = parseDay(url.searchParams.get("to"));
  const limit = Math.min(safeNum(url.searchParams.get("limit") || 15) || 15, 100);

  // default últimos 14 días (UTC estable)
  const toD = to || utcDayString();
  const fromDate = new Date(`${toD}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 13);
  const fromD = from || utcDayString(fromDate);

  await connectDB();

  // OJO: acá usás "day". Asegurate que el webhook también use "day".
  const docs = await DailyMetric.find(
    { day: { $gte: fromD, $lte: toD } },
    { itemsBySlug: 1, revenueBySlug: 1 }
  ).lean();

  const qtyBySlug = new Map();
  const revBySlug = new Map();

  for (const d of docs) {
    const qtyObj = toPlainObject(d.itemsBySlug);
    const revObj = toPlainObject(d.revenueBySlug);

    for (const [slug, qty] of Object.entries(qtyObj)) {
      const s = String(slug);
      qtyBySlug.set(s, (qtyBySlug.get(s) || 0) + safeNum(qty));
    }

    for (const [slug, rev] of Object.entries(revObj)) {
      const s = String(slug);
      revBySlug.set(s, (revBySlug.get(s) || 0) + safeNum(rev));
    }
  }

  const slugs = new Set([...qtyBySlug.keys(), ...revBySlug.keys()]);

  const rows = Array.from(slugs)
    .map((slug) => ({
      slug,
      qty: qtyBySlug.get(slug) || 0,
      revenue: revBySlug.get(slug) || 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const topByRevenue = rows.slice(0, limit);
  const topByQty = [...rows].sort((a, b) => b.qty - a.qty).slice(0, limit);

  return NextResponse.json({
    ok: true,
    from: fromD,
    to: toD,
    topByRevenue,
    topByQty,
  });
}
