const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_DATASET_ID = process.env.META_DATASET_ID;
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE;

export async function sendCapiEvent(payload) {
  if (!META_ACCESS_TOKEN || !META_DATASET_ID) {
    console.warn("[Meta CAPI] Missing envs");
    return { ok: false, skipped: true };
  }

  const url = `https://graph.facebook.com/v18.0/${META_DATASET_ID}/events?access_token=${META_ACCESS_TOKEN}`;

  const body = {
    data: [payload],
  };

  if (META_TEST_EVENT_CODE) body.test_event_code = META_TEST_EVENT_CODE;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("[Meta CAPI] error", resp.status, json);
    return { ok: false, status: resp.status, json };
  }

  return { ok: true, json };
}