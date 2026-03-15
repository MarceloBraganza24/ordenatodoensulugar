"use client";

export function getCookie(name) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

export function getFbp() {
  return getCookie("_fbp");
}

export function getFbc() {
  return getCookie("_fbc");
}

export function newEventId(prefix = "ev") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}