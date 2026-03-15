import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { sendOrderPaidEmail } from "@/lib/email";

function requireAdmin(req) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");

  const token = req.cookies.get("admin_token")?.value;
  if (!token) return null;

  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

const PatchSchema = z.object({
  shippingStatus: z.enum(["pending", "shipped", "delivered"]).optional(),
  trackingCode: z.string().max(80).optional(),
  adminNotes: z.string().max(2000).optional(),
});

export async function PATCH(req, ctx) {
  const user = requireAdmin(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;

  await connectDB();

  const order = await Order.findById(id);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const previousShippingStatus = order.shippingStatus;

  if (parsed.data.shippingStatus !== undefined) {
    order.shippingStatus = parsed.data.shippingStatus;
  }

  if (parsed.data.trackingCode !== undefined) {
    order.trackingCode = parsed.data.trackingCode;
  }

  if (parsed.data.adminNotes !== undefined) {
    order.adminNotes = parsed.data.adminNotes;
  }

  const justChangedToShipped =
    previousShippingStatus !== "shipped" &&
    order.shippingStatus === "shipped";

  if (justChangedToShipped && !order.shippedEmailSent) {
    try {
      await sendOrderPaidEmail({
        to: order?.buyer?.email,
        buyerName: order?.buyer?.name,
        orderCode: order?.publicCode,
        trackingCode: order?.trackingCode,
      });

      order.shippedEmailSent = true;
      order.shippedEmailSentAt = new Date();
    } catch (error) {
      console.error("SHIPPED EMAIL ERROR:", error);
      // opcional: decidir si igual querés guardar el cambio de estado
      // en este caso lo seguimos guardando aunque falle el mail
    }
  }

  await order.save();

  return NextResponse.json({
    ok: true,
    order,
  });
}