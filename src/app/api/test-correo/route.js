import { NextResponse } from "next/server";

export async function GET() {
  try {
    const basic = Buffer.from(
      `${process.env.CA_USERNAME}:${process.env.CA_PASSWORD}`
    ).toString("base64");

    const res = await fetch(`${process.env.CA_BASE_URL}/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
      },
      cache: "no-store",
    });

    const data = await res.json();

    return NextResponse.json({
      ok: true,
      status: res.status,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}