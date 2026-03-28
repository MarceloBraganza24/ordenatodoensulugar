import { NextResponse } from "next/server";
import { getCorreoToken } from "@/lib/correoArgentino";

export const runtime = "nodejs";

export async function GET() {
  try {
    const token = await getCorreoToken();

    const customerId = process.env.CA_CUSTOMER_ID;
    const provinceCode = "B";

    const url = new URL(`${process.env.CA_BASE_URL}/agencies`);
    url.searchParams.set("customerId", customerId);
    url.searchParams.set("provinceCode", provinceCode);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      requestUrl: url.toString(),
      data,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}