import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { SEED_PRODUCTS } from "@/lib/seed-products";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seed disabled in production" }, { status: 403 });
  }

  await connectDB();
  for (const p of SEED_PRODUCTS) {
    await Product.updateOne({ slug: p.slug }, { $set: p }, { upsert: true });
  }
  return NextResponse.json({ ok: true, count: SEED_PRODUCTS.length });
}
