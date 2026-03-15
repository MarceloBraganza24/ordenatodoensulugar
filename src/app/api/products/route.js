import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";

export async function GET() {
  try {
    await connectDB();
    
    const products = await Product.find({ isActive: true })
    .sort({ createdAt: 1 })
    .lean();
    
    return NextResponse.json({ ok: true, products });
  } catch (error) {
    console.error("GET /api/products error:", error);
    
    return NextResponse.json(
      {
        ok: false,
        products: [],
        error: "No se pudieron cargar los productos",
      },
      { status: 500 }
    );
  }
}


/* import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";

export async function GET() {
  await connectDB();
  const products = await Product.find({ isActive: true }).sort({ createdAt: 1 }).lean();
  return NextResponse.json({ products });
} */
