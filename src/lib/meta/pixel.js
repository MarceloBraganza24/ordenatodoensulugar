export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export const fbq = (...args) => {
  if (typeof window === "undefined") return;
  if (!window.fbq) return;
  window.fbq(...args);
};

export const track = (eventName, params = {}, eventId) => {
  if (eventId) params.eventID = eventId; // dedupe con CAPI
  fbq("track", eventName, params);
};

export const trackCustom = (eventName, params = {}, eventId) => {
  if (eventId) params.eventID = eventId;
  fbq("trackCustom", eventName, params);
};
