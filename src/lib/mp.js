import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

export function mpClient() {
  if (!process.env.MP_ACCESS_TOKEN) throw new Error("Missing MP_ACCESS_TOKEN");
  return new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
}

export function mpPreference() {
  return new Preference(mpClient());
}

export function mpPayment() {
  return new Payment(mpClient());
}
