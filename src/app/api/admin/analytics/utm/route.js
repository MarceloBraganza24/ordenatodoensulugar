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
  if (typeof m === "object") return m;
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

function splitKey(k) {
  const [source, campaign] = String(k || "").split("|");
  return { source: source || "direct", campaign: campaign || "none" };
}

export async function GET(req) {
  const guard = requireAdminGuard(req);
  if (guard) return guard;

  const url = new URL(req.url);
  const from = parseDay(url.searchParams.get("from"));
  const to = parseDay(url.searchParams.get("to"));
  const limit = Math.min(safeNum(url.searchParams.get("limit") || 20) || 20, 100);

  // default últimos 14 días (UTC estable)
  const toD = to || utcDayString();
  const fromDate = new Date(`${toD}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 13);
  const fromD = from || utcDayString(fromDate);

  await connectDB();

  // OJO: "day" debe existir y matchear el webhook
  const docs = await DailyMetric.find(
    { day: { $gte: fromD, $lte: toD } },
    { utmRevenue: 1 }
  ).lean();

  const revByKey = new Map();

  for (const d of docs) {
    const utmObj = toPlainObject(d.utmRevenue);
    for (const [k, rev] of Object.entries(utmObj)) {
      const key = String(k);
      revByKey.set(key, (revByKey.get(key) || 0) + safeNum(rev));
    }
  }

  const rows = Array.from(revByKey.entries())
    .map(([k, revenue]) => {
      const { source, campaign } = splitKey(k);
      return { key: k, source, campaign, revenue };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);

  return NextResponse.json({ ok: true, from: fromD, to: toD, rows });
}
