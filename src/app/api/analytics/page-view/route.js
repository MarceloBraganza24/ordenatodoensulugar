import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/analyticsStore";
import { getOrCreateSid } from "@/lib/analytics";
import { connectDB } from "@/lib/db";
import { PageViewDedup } from "@/models/PageViewDedup";

function h(req, key) {
  return String(req.headers.get(key) || "").trim();
}

function normalizePath(path) {
  const p = String(path || "").trim();
  return p || "/";
}

function getWindowKey(date = new Date(), windowSeconds = 30) {
  const bucket = Math.floor(date.getTime() / 1000 / windowSeconds);
  return String(bucket);
}

function isDuplicateKeyError(err) {
  return err?.code === 11000;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const path = normalizePath(body?.path || h(req, "x-path") || "/");
    const ref = String(body?.ref || h(req, "x-ref") || "").trim();

    const utm = {
      source: String(body?.utm?.source || h(req, "x-utm-source") || "").trim(),
      medium: String(body?.utm?.medium || h(req, "x-utm-medium") || "").trim(),
      campaign: String(body?.utm?.campaign || h(req, "x-utm-campaign") || "").trim(),
      term: String(body?.utm?.term || h(req, "x-utm-term") || "").trim(),
      content: String(body?.utm?.content || h(req, "x-utm-content") || "").trim(),
    };

    const res = NextResponse.json({ ok: true, deduped: false });
    const sid = getOrCreateSid(req, res);

    const now = new Date();
    const windowKey = getWindowKey(now, 30); // ← ventana de 30 segundos

    await connectDB();

    try {
      await PageViewDedup.create({
        sid,
        path,
        windowKey,
        createdAt: now,
      });
    } catch (e) {
      if (isDuplicateKeyError(e)) {
        return NextResponse.json({ ok: true, deduped: true });
      }
      throw e;
    }

    await recordEvent({
      type: "page_view",
      ts: now,
      sid,
      path,
      ref,
      utm,
      meta: {
        source: "frontend",
        windowKey,
      },
    });

    return res;
  } catch (e) {
    console.error("[analytics/page-view] error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}