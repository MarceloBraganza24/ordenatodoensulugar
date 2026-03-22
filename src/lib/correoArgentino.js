const BASE_URL = process.env.CA_BASE_URL;
const USERNAME = process.env.CA_USERNAME;
const PASSWORD = process.env.CA_PASSWORD;
const CUSTOMER_ID = process.env.CA_CUSTOMER_ID;
const POSTAL_CODE_ORIGIN = process.env.CA_POSTAL_CODE_ORIGIN;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getCorreoToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const basic = Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");

  const res = await fetch(`${BASE_URL}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Correo token error: ${res.status} - ${text}`);
  }

  const data = await res.json();

  cachedToken = data.token;

  // margen de seguridad
  const expiresAt = data.expires ? new Date(data.expires).getTime() : Date.now() + 15 * 60 * 1000;
  cachedTokenExpiresAt = expiresAt - 60 * 1000;

  return cachedToken;
}

export async function quoteCorreoShipment({
  postalCodeDestination,
  deliveryType, // "D" o "S"
  dimensions,
}) {
  const token = await getCorreoToken();

  const payload = {
    customerId: CUSTOMER_ID,
    postalCodeOrigin: POSTAL_CODE_ORIGIN,
    postalCodeDestination,
    deliveredType: deliveryType,
    dimensions: {
      weight: Math.round(dimensions.weight),
      height: Math.round(dimensions.height),
      width: Math.round(dimensions.width),
      length: Math.round(dimensions.length),
    },
  };

  const res = await fetch(`${BASE_URL}/rates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      `Correo rates error: ${res.status} - ${JSON.stringify(data || {})}`
    );
  }

  return data;
}