import { quoteCorreoOrder } from "@/lib/correoArgentino";

export async function POST(req) {
  const body = await req.json();

  const items = body.items || [];
  const postalCodeDestination =
    body.buyer?.shippingAddress?.postalCode || body.buyer?.shipping?.postalCode;

  const shippingQuote = await quoteCorreoOrder({
    postalCodeDestination,
    items,
    deliveredType: "D",
  });

  const shippingTotal = shippingQuote.price;

  // después calculás total real y creás la orden
}