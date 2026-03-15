import { quoteCorreo } from "@/lib/shipping/correo";

export async function POST(req) {
  const body = await req.json();
  const items = body.items;
  const postalCodeDestination = body.buyer?.shipping?.postalCode;

  // 👇 ACÁ VA TAMBIÉN
  const shippingQuote = await quoteCorreo({
    postalCodeDestination,
    items,
  });

  const shippingTotal = shippingQuote.price;

  // después calculás total real y creás la orden
}