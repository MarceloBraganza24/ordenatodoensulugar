"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import { formatARS } from "@/lib/money";
import { startCheckout } from "@/lib/clientCheckout";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const FREE_SHIPPING_THRESHOLD = 45000;
const FREE_SHIPPING_PRODUCT_SLUGS = ["pack-completo"];
const CHECKOUT_DRAFT_KEY = "cart_checkout_draft_v1";

const ORIGIN_ZIP = String(
  process.env.NEXT_PUBLIC_CA_POSTAL_ORIGIN ||
    process.env.NEXT_PUBLIC_CA_POSTAL_CODE_ORIGIN ||
    ""
)
  .replace(/\D/g, "")
  .slice(0, 4);

function isFreeShippingZip(destZip, provinceCode) {
  const dz = String(destZip || "").replace(/\D/g, "").slice(0, 4);
  return provinceCode === "B" && ORIGIN_ZIP && dz && dz === ORIGIN_ZIP;
}

const PROVINCES_AR = [
  { name: "Buenos Aires", code: "B" },
  { name: "CABA", code: "C" },
  { name: "Catamarca", code: "K" },
  { name: "Chaco", code: "H" },
  { name: "Chubut", code: "U" },
  { name: "Córdoba", code: "X" },
  { name: "Corrientes", code: "W" },
  { name: "Entre Ríos", code: "E" },
  { name: "Formosa", code: "P" },
  { name: "Jujuy", code: "Y" },
  { name: "La Pampa", code: "L" },
  { name: "La Rioja", code: "F" },
  { name: "Mendoza", code: "M" },
  { name: "Misiones", code: "N" },
  { name: "Neuquén", code: "Q" },
  { name: "Río Negro", code: "R" },
  { name: "Salta", code: "A" },
  { name: "San Juan", code: "J" },
  { name: "San Luis", code: "D" },
  { name: "Santa Cruz", code: "Z" },
  { name: "Santa Fe", code: "S" },
  { name: "Santiago del Estero", code: "G" },
  { name: "Tierra del Fuego", code: "V" },
  { name: "Tucumán", code: "T" },
];

const STEP_META = [
  { id: 1, label: "Pedido" },
  { id: 2, label: "Datos" },
  { id: 3, label: "Entrega" },
  { id: 4, label: "Pago" },
];

const onlyDigits = (s) => (s || "").replace(/\D/g, "");
const normalizeZip = (v) => onlyDigits(v).slice(0, 8);

const isValidEmail = (email) =>
  !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPhoneSoft = (phone) => {
  const digits = onlyDigits(phone);
  return digits.length >= 10 && digits.length <= 15;
};

const isValidZip = (v) => normalizeZip(v).length >= 4;

function getFlatShippingQuote({ postalCode, provinceCode }) {
  const zip = normalizeZip(postalCode);
  const prefix = zip.charAt(0);
  const p = String(provinceCode || "").toUpperCase().trim();

  if (ORIGIN_ZIP && zip && zip === ORIGIN_ZIP && p === "B") {
    return {
      carrier: "Envío gratis",
      service: "Zona local",
      price: 0,
      eta: "Coordinar entrega",
      deliveredType: "D",
      mode: "flat",
    };
  }

  // AMBA / cercanos
  if (["1", "2", "3"].includes(prefix)) {
    return {
      carrier: "Envío estándar",
      service: "A domicilio",
      price: 6900,
      eta: "2 a 5 días hábiles",
      deliveredType: "D",
      mode: "flat",
    };
  }

  // Interior / centro / sur bonaerense
  if (["4", "5", "6", "7", "8"].includes(prefix)) {
    return {
      carrier: "Envío estándar",
      service: "A domicilio",
      price: 7900,
      eta: "2 a 6 días hábiles",
      deliveredType: "D",
      mode: "flat",
    };
  }

  // Patagonia más lejana
  if (["9"].includes(prefix) || ["R", "Q", "U", "Z", "V"].includes(p)) {
    return {
      carrier: "Envío estándar",
      service: "A domicilio",
      price: 11900,
      eta: "4 a 10 días hábiles",
      deliveredType: "D",
      mode: "flat",
    };
  }

  return {
    carrier: "Envío estándar",
    service: "A domicilio",
    price: 8900,
    eta: "3 a 9 días hábiles",
    deliveredType: "D",
    mode: "flat",
  };
}

function getDeliveryEtaByZone({ provinceCode, qualifiesByLocalZip }) {
  if (qualifiesByLocalZip) {
    return "Coordinar entrega";
  }

  const p = String(provinceCode || "").toUpperCase().trim();

  if (p === "B" || p === "C") {
    return "3 a 7 días hábiles";
  }

  if (["R", "Q", "U", "Z", "V"].includes(p)) {
    return "4 a 10 días hábiles";
  }

  return "3 a 9 días hábiles";
}

function getEstimatedShippingForStep1({ provinceCode }) {
  const p = String(provinceCode || "").toUpperCase().trim();

  if (p === "B" || p === "C") return 6900;
  if (["R", "Q", "U", "Z", "V"].includes(p)) return 11900;
  if (p) return 7900;

  return 6900;
}

function getShortAddress({ streetName, streetNumber }) {
  return [streetName, streetNumber].filter(Boolean).join(" ");
}
function normalizeQuoteFromApi(data, fallbackProvinceCode, fallbackPostalCode) {
  if (!data || typeof data !== "object") return null;

  const q = data.quote;
  if (q && typeof q === "object" && Number(q.price) >= 0) {
    return {
      carrier: q.carrier || q.provider || "Envío estándar",
      service: q.service || "A domicilio",
      price: Number(q.price || 0),
      eta: q.eta || "",
      deliveredType: q.deliveredType || "D",
      mode: q.mode || "paid",
    };
  }

  if (Number.isFinite(Number(data.shippingPrice))) {
    return {
      carrier:
        data.provider === "correo_argentino"
          ? "Correo Argentino"
          : "Envío estándar",
      service:
        data.quote?.rates?.[0]?.productName ||
        data.quote?.rates?.[0]?.productType ||
        "A domicilio",
      price: Number(data.shippingPrice || 0),
      eta: data.quote?.rates?.[0]?.deliveryTimeMin
        ? `${data.quote.rates[0].deliveryTimeMin}-${data.quote.rates[0].deliveryTimeMax} días`
        : "",
      deliveredType: data.deliveredTypeUsed || "D",
      mode: data.fallbackUsed ? "flat" : "paid",
    };
  }

  if (fallbackProvinceCode) {
    return getFlatShippingQuote({
      postalCode:
        fallbackPostalCode ||
        data?.postalCodeDestinationUsed ||
        data?.quote?.postalCodeDestination ||
        "",
      provinceCode: fallbackProvinceCode,
    });
  }

  return null;
}

function buildQuoteKey({
  itemsSig,
  province,
  city,
  postalCode,
  formattedAddress,
  googlePlaceId,
}) {
  return [
    itemsSig || "",
    String(province || "").trim().toUpperCase(),
    String(city || "").trim().toLowerCase(),
    normalizeZip(postalCode || ""),
    String(formattedAddress || "").trim(),
    String(googlePlaceId || "").trim(),
  ].join("|");
}

export function CartDrawer() {
  const cart = useCart();
  const panelScrollRef = useRef(null);
  const draftLoadedRef = useRef(false);

  const [isDesktop, setIsDesktop] = useState(false);
  const [step, setStep] = useState(1);

  // Buyer
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Address
  const [addressQuery, setAddressQuery] = useState("");
  const [formattedAddress, setFormattedAddress] = useState("");
  const [googlePlaceId, setGooglePlaceId] = useState("");

  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [streetName, setStreetName] = useState("");
  const [streetNumber, setStreetNumber] = useState("");

  // Delivery details
  const [apt, setApt] = useState("");
  const [dni, setDni] = useState("");
  const [notes, setNotes] = useState("");

  // UI
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Upsell
  const [upsell, setUpsell] = useState(null);
  const [upsellBusy, setUpsellBusy] = useState(false);

  // Shipping
  const [shipQuote, setShipQuote] = useState(null);
  const [shipStatus, setShipStatus] = useState("idle");
  const [shipError, setShipError] = useState("");
  const [confirmedQuoteKey, setConfirmedQuoteKey] = useState("");

  const zip = normalizeZip(postalCode);

  const provinceName = useMemo(() => {
    const found = PROVINCES_AR.find((p) => p.code === province);
    return found ? found.name : "";
  }, [province]);

  const itemsSig = useMemo(() => {
    return cart.items.map((it) => `${it.slug}:${it.qty}`).sort().join("|");
  }, [cart.items]);

  const qualifiesByAmount = cart.total >= FREE_SHIPPING_THRESHOLD;
  const remainingForFreeShipping = Math.max(
    FREE_SHIPPING_THRESHOLD - cart.total,
    0
  );

  const freeShippingProgress = Math.min(
    (cart.total / FREE_SHIPPING_THRESHOLD) * 100,
    100
  );

  const hasFreeShippingProduct = cart.items.some((it) =>
    FREE_SHIPPING_PRODUCT_SLUGS.includes(it.slug)
  );

  const qualifiesByLocalZip = isFreeShippingZip(zip, province);

  const shouldApplyFreeShipping =
    hasFreeShippingProduct || qualifiesByAmount || qualifiesByLocalZip;

  const hasAddressForQuote = Boolean(
    formattedAddress &&
      googlePlaceId &&
      province &&
      city.trim() &&
      streetName.trim() &&
      isValidZip(postalCode)
  );

  const currentQuoteKey = useMemo(() => {
    return buildQuoteKey({
      itemsSig,
      province,
      city,
      postalCode,
      formattedAddress,
      googlePlaceId,
    });
  }, [itemsSig, province, city, postalCode, formattedAddress, googlePlaceId]);

  const hasCalculatedShipping =
    shouldApplyFreeShipping ||
    (shipStatus === "ok" &&
      !!shipQuote &&
      !!confirmedQuoteKey &&
      confirmedQuoteKey === currentQuoteKey);

  const resolvedShipQuote = useMemo(() => {
    if (shouldApplyFreeShipping) {
      return {
        carrier: "Gratis",
        service: qualifiesByLocalZip
          ? "Retiro / entrega local"
          : hasFreeShippingProduct
          ? "Incluido en este pack"
          : `Gratis desde ${formatARS(FREE_SHIPPING_THRESHOLD)}`,
        price: 0,
        eta: qualifiesByLocalZip
          ? "Coordinar entrega"
          : shipQuote?.eta || "",
        deliveredType: "D",
        mode: "free",
      };
    }

    if (hasCalculatedShipping && shipQuote) {
      return shipQuote;
    }

    return null;
  }, [
    shouldApplyFreeShipping,
    qualifiesByLocalZip,
    hasFreeShippingProduct,
    hasCalculatedShipping,
    shipQuote,
  ]);

  const previewShippingPrice = useMemo(() => {
    if (shouldApplyFreeShipping) return 0;

    // Mientras NO haya cotización confirmada para la combinación actual,
    // mostramos el mínimo/base visual del step 1.
    return getEstimatedShippingForStep1({ provinceCode: "" });
  }, [shouldApplyFreeShipping]);

  const shippingPrice = useMemo(() => {
    if (hasCalculatedShipping && resolvedShipQuote) {
      return Number(resolvedShipQuote.price || 0);
    }

    return previewShippingPrice;
  }, [hasCalculatedShipping, resolvedShipQuote, previewShippingPrice]);

  const grandTotal = cart.total + shippingPrice;

  const shippingLineLabel = !hasCalculatedShipping ? "Envío desde" : "Envío";
  const totalLineLabel = !hasCalculatedShipping ? "Total estimado" : "Total";

  const hasSelectedAddress =
    !!formattedAddress &&
    !!streetName &&
    !!city &&
    !!province &&
    !!postalCode;

  const missingStreetNumber = hasSelectedAddress && !streetNumber.trim();

  const shippingEtaLabel = useMemo(() => {
    if (shouldApplyFreeShipping) {
      return qualifiesByLocalZip ? "Coordinación local" : "Envío incluido";
    }

    if (!hasCalculatedShipping) {
      return "";
    }

    return resolvedShipQuote?.eta || "";
  }, [
    shouldApplyFreeShipping,
    qualifiesByLocalZip,
    hasCalculatedShipping,
    resolvedShipQuote,
  ]);

  const deliveryEtaText = useMemo(() => {
    if (qualifiesByLocalZip) {
      return "Coordinar entrega";
    }

    if (resolvedShipQuote?.eta) {
      return resolvedShipQuote.eta;
    }

    return getDeliveryEtaByZone({
      provinceCode: province,
      qualifiesByLocalZip,
    });
  }, [resolvedShipQuote, province, qualifiesByLocalZip]);

  useEffect(() => {
    const el = panelScrollRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollTop = 0;
    });
  }, [step]);

  const scrollToField = (id) => {
    if (!id) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof el.focus === "function") el.focus();
    });
  };

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!cart.isOpen) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [cart.isOpen]);

  useEffect(() => {
    if (!cart.isOpen) return;
    const onKey = (e) => e.key === "Escape" && cart.close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart.isOpen, cart.close]);

  useEffect(() => {
    if (!cart.isOpen) return;

    let cancelled = false;

    fetch("/api/products")
      .then((r) => r.json())
      .then(({ products }) => {
        if (cancelled) return;
        const u = products.find((x) => x.kind === "UPSELL");
        setUpsell(u || null);
      })
      .catch(() => {
        if (!cancelled) setUpsell(null);
      });

    return () => {
      cancelled = true;
    };
  }, [cart.isOpen]);

  useEffect(() => {
    if (draftLoadedRef.current) return;

    try {
      const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
      if (!raw) {
        draftLoadedRef.current = true;
        return;
      }

      const draft = JSON.parse(raw);

      setStep(Number(draft.step || 1));
      setName(draft.name || "");
      setPhone(draft.phone || "");
      setEmail(draft.email || "");

      setAddressQuery(draft.addressQuery || "");
      setFormattedAddress(draft.formattedAddress || "");
      setGooglePlaceId(draft.googlePlaceId || "");

      setProvince(draft.province || "");
      setCity(draft.city || "");
      setPostalCode(draft.postalCode || "");
      setStreetName(draft.streetName || "");
      setStreetNumber(draft.streetNumber || "");

      setApt(draft.apt || "");
      setDni(draft.dni || "");
      setNotes(draft.notes || "");

      setShipQuote(draft.shipQuote || null);
      setShipStatus(draft.shipQuote ? "ok" : "idle");
      setShipError("");
      setConfirmedQuoteKey(draft.confirmedQuoteKey || "");
    } catch {
      // ignore
    } finally {
      draftLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!draftLoadedRef.current) return;

    try {
      const draft = {
        step,
        name,
        phone,
        email,
        addressQuery,
        formattedAddress,
        googlePlaceId,
        province,
        city,
        postalCode,
        streetName,
        streetNumber,
        apt,
        dni,
        notes,
        shipQuote,
        confirmedQuoteKey,
      };

      sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [
    step,
    name,
    phone,
    email,
    addressQuery,
    formattedAddress,
    googlePlaceId,
    province,
    city,
    postalCode,
    streetName,
    streetNumber,
    apt,
    dni,
    notes,
    shipQuote,
    confirmedQuoteKey,
  ]);

  useEffect(() => {
    if (cart.items.length > 0) return;

    try {
      sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
    } catch {
      // ignore
    }

    setStep(1);
    setErr("");
    setShipQuote(null);
    setShipStatus("idle");
    setShipError("");
    setConfirmedQuoteKey("");
  }, [cart.items.length]);

  // Reconciliación única de cotización confirmada
  useEffect(() => {
    if (!cart.isOpen) return;

    if (!hasAddressForQuote) {
      if (shipQuote || shipStatus !== "idle" || confirmedQuoteKey) {
        setShipQuote(null);
        setShipStatus("idle");
        setShipError("");
        setConfirmedQuoteKey("");
        if (step > 2) setStep(2);
      }
      return;
    }

    if (shouldApplyFreeShipping) {
      const freeQuote = {
        carrier: "Gratis",
        service: qualifiesByLocalZip
          ? "Retiro / entrega local"
          : hasFreeShippingProduct
          ? "Incluido en este pack"
          : `Gratis desde ${formatARS(FREE_SHIPPING_THRESHOLD)}`,
        price: 0,
        eta: qualifiesByLocalZip
          ? "Coordinar entrega"
          : shipQuote?.eta || "",
        deliveredType: "D",
        mode: "free",
      };

      if (
        !shipQuote ||
        shipQuote.price !== freeQuote.price ||
        shipQuote.service !== freeQuote.service ||
        shipQuote.mode !== freeQuote.mode ||
        confirmedQuoteKey !== currentQuoteKey ||
        shipStatus !== "ok"
      ) {
        setShipQuote(freeQuote);
        setShipStatus("ok");
        setShipError("");
        setConfirmedQuoteKey(currentQuoteKey);
      }

      return;
    }

    if (confirmedQuoteKey && confirmedQuoteKey !== currentQuoteKey) {
      setShipQuote(null);
      setShipStatus("idle");
      setShipError("El carrito o la dirección cambió. Volvé a recalcular el envío.");
      setConfirmedQuoteKey("");
      if (step > 2) setStep(2);
    }
  }, [
    cart.isOpen,
    hasAddressForQuote,
    shouldApplyFreeShipping,
    qualifiesByLocalZip,
    hasFreeShippingProduct,
    currentQuoteKey,
    confirmedQuoteKey,
    shipQuote,
    shipStatus,
    step,
  ]);

  const upsellAlreadyInCart = useMemo(() => {
    if (!upsell?.slug) return false;
    return cart.items.some((it) => it.slug === upsell.slug);
  }, [cart.items, upsell?.slug]);

  const canShowUpsell = !!upsell && cart.items.length > 0 && !upsellAlreadyInCart;

  const addUpsell = async () => {
    if (!upsell) return;
    setUpsellBusy(true);
    try {
      cart.addItem(upsell, 1);
    } finally {
      setTimeout(() => setUpsellBusy(false), 180);
    }
  };

  const handleAddressSelected = async (addr) => {
    const nextAddressQuery = addr?.label || addr?.formattedAddress || "";
    const nextFormattedAddress = addr?.formattedAddress || addr?.label || "";
    const nextGooglePlaceId = addr?.googlePlaceId || addr?.placeId || "";
    const nextStreetName = addr?.streetName || "";
    const nextStreetNumber = addr?.streetNumber || "";
    const nextCity = addr?.city || "";
    const nextProvince = addr?.provinceCode || "";
    const nextPostalCode = addr?.postalCode || "";

    setAddressQuery(nextAddressQuery);
    setStreetName(nextStreetName);
    setStreetNumber(nextStreetNumber);
    setCity(nextCity);
    setProvince(nextProvince);
    setPostalCode(nextPostalCode);
    setFormattedAddress(nextFormattedAddress);
    setGooglePlaceId(nextGooglePlaceId);

    await quoteShipping({
      addressQuery: nextAddressQuery,
      formattedAddress: nextFormattedAddress,
      googlePlaceId: nextGooglePlaceId,
      province: nextProvince,
      city: nextCity,
      postalCode: nextPostalCode,
    });
  };

  async function quoteShipping(overrides = {}) {
    setErr("");
    setShipError("");
    setShipStatus("idle");
    setShipQuote(null);
    setConfirmedQuoteKey("");

    const currentAddressQuery = (overrides.addressQuery ?? addressQuery ?? "").trim();
    const currentFormattedAddress = (
      overrides.formattedAddress ??
      formattedAddress ??
      currentAddressQuery
    ).trim();
    const currentGooglePlaceId = String(
      overrides.googlePlaceId ?? googlePlaceId ?? ""
    ).trim();
    const currentProvince = overrides.province ?? province;
    const currentCity = (overrides.city ?? city ?? "").trim();
    const currentPostalCode = normalizeZip(overrides.postalCode ?? postalCode);

    if (!currentAddressQuery) {
      setShipStatus("error");
      setShipError("Ingresá tu dirección.");
      scrollToField("ship_address_search");
      return;
    }

    if (!currentFormattedAddress || !currentGooglePlaceId) {
      setShipStatus("error");
      setShipError("Elegí una dirección válida de la lista.");
      scrollToField("ship_address_search");
      return;
    }

    if (!currentProvince) {
      setShipStatus("error");
      setShipError(
        "Necesitamos una provincia válida. Elegí una dirección sugerida."
      );
      scrollToField("ship_address_search");
      return;
    }

    if (!currentCity) {
      setShipStatus("error");
      setShipError(
        "Necesitamos una ciudad/localidad válida. Elegí una dirección sugerida."
      );
      scrollToField("ship_address_search");
      return;
    }

    if (!isValidZip(currentPostalCode)) {
      setShipStatus("error");
      setShipError(
        "Necesitamos un código postal válido. Elegí una dirección sugerida."
      );
      scrollToField("ship_address_search");
      return;
    }

    if (!cart.items.length) {
      setShipStatus("error");
      setShipError("Tu carrito está vacío.");
      return;
    }

    const hasFreeShippingProductInCart = cart.items.some((it) =>
      FREE_SHIPPING_PRODUCT_SLUGS.includes(it.slug)
    );

    const qualifiesByAmountNow = cart.total >= FREE_SHIPPING_THRESHOLD;
    const qualifiesByLocalZipNow = isFreeShippingZip(
      currentPostalCode,
      currentProvince
    );

    if (
      hasFreeShippingProductInCart ||
      qualifiesByAmountNow ||
      qualifiesByLocalZipNow
    ) {
      let service = "(incluido en tu compra)";

      if (qualifiesByLocalZipNow) {
        service = "(retiro / entrega local)";
      } else if (qualifiesByAmountNow) {
        service = `(gratis desde ${formatARS(FREE_SHIPPING_THRESHOLD)})`;
      } else if (hasFreeShippingProductInCart) {
        service = "(incluido en este pack)";
      }

      setShipQuote({
        carrier: "Gratis",
        service,
        price: 0,
        eta: qualifiesByLocalZipNow ? "Coordinar entrega" : "",
        deliveredType: "D",
        mode: "free",
      });
      setShipStatus("ok");
      setShipError("");
      setConfirmedQuoteKey(
        buildQuoteKey({
          itemsSig,
          province: currentProvince,
          city: currentCity,
          postalCode: currentPostalCode,
          formattedAddress: currentFormattedAddress,
          googlePlaceId: currentGooglePlaceId,
        })
      );
      return;
    }

    setShipStatus("loading");

    try {
      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postalCode: currentPostalCode,
          deliveredType: "D",
          items: cart.items.map((it) => ({ slug: it.slug, qty: it.qty })),
          destination: {
            province: currentProvince,
            city: currentCity || null,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      const normalized = normalizeQuoteFromApi(
        data,
        currentProvince,
        currentPostalCode
      );

      if (!res.ok || !normalized) {
        throw new Error(data?.error || "No se pudo cotizar.");
      }

      setShipQuote(normalized);
      setShipStatus("ok");
      setShipError("");
      setConfirmedQuoteKey(
        buildQuoteKey({
          itemsSig,
          province: currentProvince,
          city: currentCity,
          postalCode: currentPostalCode,
          formattedAddress: currentFormattedAddress,
          googlePlaceId: currentGooglePlaceId,
        })
      );
    } catch (e) {
      console.warn("[cart] quoteShipping fallback local", {
        message: e?.message,
        province: currentProvince,
        postalCode: currentPostalCode,
      });

      const q = getFlatShippingQuote({
        postalCode: currentPostalCode,
        provinceCode: currentProvince,
      });

      setShipQuote(q);
      setShipStatus("ok");
      setShipError("");
      setConfirmedQuoteKey(
        buildQuoteKey({
          itemsSig,
          province: currentProvince,
          city: currentCity,
          postalCode: currentPostalCode,
          formattedAddress: currentFormattedAddress,
          googlePlaceId: currentGooglePlaceId,
        })
      );
    }
  }

  const validateStep1 = () => {
    if (!cart.items.length) {
      return { msg: "Tu carrito está vacío.", fieldId: "" };
    }

    return { msg: "", fieldId: "" };
  };

  const validateStep2 = () => {
    if (!name.trim()) {
      return { msg: "Ingresá tu nombre y apellido.", fieldId: "buyer_name" };
    }

    if (!phone.trim()) {
      return {
        msg: "Ingresá tu teléfono (WhatsApp).",
        fieldId: "buyer_phone",
      };
    }

    if (!isValidPhoneSoft(phone)) {
      return {
        msg: "Revisá el teléfono (10 a 15 dígitos aprox.).",
        fieldId: "buyer_phone",
      };
    }

    if (!email.trim()) {
      return {
        msg: "El email es obligatorio para enviarte el seguimiento del pedido.",
        fieldId: "buyer_email",
      };
    }

    if (!isValidEmail(email.trim())) {
      return { msg: "Email inválido.", fieldId: "buyer_email" };
    }

    if (!addressQuery.trim()) {
      return { msg: "Ingresá tu dirección.", fieldId: "ship_address_search" };
    }

    if (!province || !city.trim() || !postalCode.trim() || !streetName.trim()) {
      return {
        msg: "La dirección seleccionada está incompleta. Probá con otra opción sugerida.",
        fieldId: "ship_address_search",
      };
    }

    if (!hasCalculatedShipping) {
      return {
        msg: "Primero calculá el envío con una dirección válida antes de continuar.",
        fieldId: "ship_address_search",
      };
    }

    return { msg: "", fieldId: "" };
  };

  const validateStep3 = () => {
    if (!formattedAddress || !googlePlaceId) {
      return {
        msg: "Necesitamos una dirección válida seleccionada desde las sugerencias.",
        fieldId: "ship_address_search",
      };
    }

    if (!streetName.trim()) {
      return {
        msg: "La dirección seleccionada no tiene calle válida. Elegí otra opción.",
        fieldId: "ship_address_search",
      };
    }

    if (!streetNumber.trim()) {
      return {
        msg: "Falta la altura de la dirección. Completala para continuar.",
        fieldId: "ship_streetNumber",
      };
    }

    if (!dni.trim()) {
      return {
        msg: "Ingresá tu DNI (lo pide el correo).",
        fieldId: "ship_dni",
      };
    }

    if (!/^\d{7,9}$/.test(onlyDigits(dni))) {
      return { msg: "DNI inválido (7 a 9 dígitos).", fieldId: "ship_dni" };
    }

    return { msg: "", fieldId: "" };
  };

  const buyer = useMemo(() => {
    return {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      shippingAddress: {
        province,
        city: city.trim(),
        postalCode: normalizeZip(postalCode),
        streetName: streetName.trim(),
        streetNumber: onlyDigits(streetNumber),
        apt: apt.trim() || null,
        dni: onlyDigits(dni),
        notes: notes.trim() || null,
        formattedAddress: formattedAddress || addressQuery.trim(),
        googlePlaceId: googlePlaceId || null,
      },
    };
  }, [
    name,
    phone,
    email,
    province,
    city,
    postalCode,
    streetName,
    streetNumber,
    apt,
    dni,
    notes,
    formattedAddress,
    addressQuery,
    googlePlaceId,
  ]);

  const goNext = () => {
    setErr("");

    if (step === 1) {
      const { msg, fieldId } = validateStep1();
      if (msg) {
        setErr(msg);
        if (fieldId) scrollToField(fieldId);
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      const result = validateStep2();

      if (result.msg) {
        setErr(result.msg);
        if (result.fieldId) scrollToField(result.fieldId);
        return;
      }

      setStep(3);
      return;
    }

    if (step === 3) {
      const { msg, fieldId } = validateStep3();
      if (msg) {
        setErr(msg);
        if (fieldId) scrollToField(fieldId);
        return;
      }
      setStep(4);
    }
  };

  const goBack = () => {
    setErr("");
    if (step > 1) setStep((prev) => prev - 1);
  };

  const checkout = async () => {
    setErr("");

    const s1 = validateStep1();
    if (s1.msg) {
      setStep(1);
      setErr(s1.msg);
      if (s1.fieldId) scrollToField(s1.fieldId);
      return;
    }

    const s2 = validateStep2();
    if (s2.msg) {
      setStep(2);
      setErr(s2.msg);
      if (s2.fieldId) scrollToField(s2.fieldId);
      return;
    }

    const s3 = validateStep3();
    if (s3.msg) {
      setStep(3);
      setErr(s3.msg);
      if (s3.fieldId) scrollToField(s3.fieldId);
      return;
    }

    const shippingPayload =
      hasCalculatedShipping && resolvedShipQuote
        ? {
            carrier: resolvedShipQuote.carrier || "Envío estándar",
            service: resolvedShipQuote.service || "A domicilio",
            price: Number(resolvedShipQuote.price || 0),
            eta: resolvedShipQuote.eta || "",
            mode: resolvedShipQuote.mode || "paid",
          }
        : null;

    if (!shippingPayload) {
      setErr("No pudimos calcular el envío. Probá de nuevo.");
      scrollToField("ship_address_search");
      return;
    }

    setBusy(true);

    try {
      await startCheckout(
        cart.items.map((it) => ({ slug: it.slug, qty: it.qty })),
        buyer,
        {
          shipping: shippingPayload,
          zip: normalizeZip(postalCode),
          orderValue: grandTotal,
        }
      );
    } catch (e) {
      console.error("checkout error:", e);
      setErr(e?.message || "No se pudo iniciar el pago. Probá de nuevo.");
      setBusy(false);
      scrollToField("cart_error");
    }
  };

  if (!cart.isOpen) return null;

  return (
    <div
      className="cartOverlay"
      onClick={!isDesktop ? cart.close : undefined}
      aria-hidden={!cart.isOpen}
    >
      <div
        className="cartPanel"
        role="dialog"
        aria-modal="true"
        aria-label="Carrito"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={panelScrollRef}
          className="cartContainer"
          role="dialog"
          aria-modal="true"
          aria-label="Carrito"
        >
          <div className="cartContainer__header">
            <div>
              <h2 className="cartContainer__title">Tu carrito</h2>
              {cart.count > 0 && (
                <p className="cartContainer__subtitle">
                  Completá tu compra en pocos pasos.
                </p>
              )}
            </div>

            <button
              className="cartContainer__close"
              type="button"
              onClick={cart.close}
              disabled={busy}
            >
              Cerrar
            </button>
          </div>

          {cart.items.length === 0 ? (
            <p className="cartContainer__empty">Tu carrito está vacío.</p>
          ) : (
            <>
              <div className="cartSteps" aria-label="Progreso de compra">
                {STEP_META.map((item) => (
                  <div
                    key={item.id}
                    className={`cartSteps__item ${
                      step === item.id
                        ? "is-active"
                        : step > item.id
                        ? "is-done"
                        : ""
                    }`}
                  >
                    <div className="cartSteps__dot">{item.id}</div>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              {step === 1 ? (
                <>
                  <div className="cartStepHero">
                    <h3 className="cartStepHero__title">
                      Estás a un paso de ordenar tu cocina ✨
                    </h3>
                    <p className="cartStepHero__text">
                      Comprá de forma rápida, segura y sin complicaciones.
                    </p>
                  </div>

                  <ul className="cartContainer__items">
                    {cart.items.map((it) => (
                      <li key={it.slug} className="cartItem">
                        <div className="cartItem__info">
                          <strong className="cartItem__title">{it.title}</strong>
                          <div className="cartItem__price">
                            {formatARS(it.price)} c/u
                          </div>
                        </div>

                        <div className="cartItem__actions">
                          <div className="cartItem__qty">
                            <button
                              type="button"
                              onClick={() => cart.dec(it.slug)}
                              disabled={busy}
                              aria-label="Disminuir"
                            >
                              -
                            </button>
                            <span aria-label="Cantidad">{it.qty}</span>
                            <button
                              type="button"
                              onClick={() => cart.inc(it.slug)}
                              disabled={busy}
                              aria-label="Aumentar"
                            >
                              +
                            </button>
                          </div>

                          <button
                            className="cartItem__remove"
                            type="button"
                            onClick={() => cart.removeItem(it.slug)}
                            disabled={busy}
                          >
                            Eliminar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="cartContainer__divider" />

                  <div className="shippingSimple" aria-live="polite">
                    {/* {shouldApplyFreeShipping ? (
                      <p className="shippingSimple__ok">
                        🚚 ¡Tu pedido tiene envío GRATIS!
                      </p>
                    ) : (
                      <p className="shippingSimple__info">
                        🚚 Envío desde: <strong>{formatARS(shippingPrice)}</strong>
                      </p>
                    )} */}
                    {!shouldApplyFreeShipping ? (
                      <div className="shippingSimple" aria-live="polite">
                        <p className="shippingSimple__info">
                          🚚 Envío desde: <strong>{formatARS(shippingPrice)}</strong>
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="freeShippingProgress" aria-live="polite">
                    {hasFreeShippingProduct ? (
                      <p className="freeShippingProgress__text freeShippingProgress__text--ok">
                        🚚 Tu compra ya incluye envío gratis
                      </p>
                    ) : qualifiesByAmount ? (
                      <p className="freeShippingProgress__text freeShippingProgress__text--ok">
                        🚚 ¡Tu pedido ya tiene envío gratis!
                      </p>
                    ) : qualifiesByLocalZip ? (
                      <p className="freeShippingProgress__text freeShippingProgress__text--ok">
                        🚚 Tenés envío gratis en tu zona
                      </p>
                    ) : (
                      <p className="freeShippingProgress__text freeShippingProgress__text--highlight">
                        🔥 Estás a solo{" "}
                        <strong>{formatARS(remainingForFreeShipping)}</strong> de obtener{" "}
                        <strong>envío GRATIS</strong>
                      </p>
                    )}

                    <div
                      className="freeShippingProgress__bar"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={FREE_SHIPPING_THRESHOLD}
                      aria-valuenow={Math.min(cart.total, FREE_SHIPPING_THRESHOLD)}
                      aria-label="Progreso hacia envío gratis"
                    >
                      <div
                        className="freeShippingProgress__fill"
                        style={{
                          width: `${
                            shouldApplyFreeShipping ? 100 : freeShippingProgress
                          }%`,
                        }}
                      />
                    </div>

                    {!shouldApplyFreeShipping ? (
                      <small className="freeShippingProgress__hint">
                        Aprovechá agregando un producto más y ahorrá en el envío. Envío gratis
                        desde {formatARS(FREE_SHIPPING_THRESHOLD)}.
                      </small>
                    ) : null}
                  </div>

                  <div className="cartTrust">
                    <div className="cartTrust__item">🔒 Pago 100% seguro con Mercado Pago</div>
                    <div className="cartTrust__item">💳 Tarjetas y cuotas disponibles</div>
                    <div className="cartTrust__item">🚚 Envíos a todo el país</div>
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <div className="cartStepCard">
                    <div className="cartStepCard__head">
                      <h3 className="cartContainer__sectionTitle">2. Tus datos y dirección</h3>
                      <p className="cartStepCard__helper">
                        Completá tus datos y elegí tu dirección para ver el envío antes de
                        pagar.
                      </p>
                    </div>

                    <div className="cartContainer__grid">
                      <div className="cartContainer__field">
                        <label htmlFor="buyer_name">Nombre y apellido</label>
                        <input
                          id="buyer_name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Tu nombre y apellido"
                          autoComplete="name"
                          inputMode="text"
                        />
                      </div>

                      <div className="cartContainer__field">
                        <label htmlFor="buyer_phone">Teléfono (WhatsApp)</label>
                        <input
                          id="buyer_phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Ej: 291 1234567"
                          autoComplete="tel"
                          inputMode="tel"
                        />
                      </div>

                      <div className="cartContainer__field cartContainer__field--wide">
                        <label htmlFor="buyer_email">Email</label>
                        <input
                          id="buyer_email"
                          value={email}
                          type="email"
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="tuemail@email.com"
                          autoComplete="email"
                          inputMode="email"
                        />
                        <small className="cartContainer__fieldHint">
                          Te enviamos la confirmación y el seguimiento de tu pedido.
                        </small>
                      </div>
                    </div>

                    <div className="cartContainer__divider" />

                    <div className="cartStepCard__head">
                      <h3 className="cartContainer__sectionTitle">
                        ¿Dónde querés recibir tu pedido?
                      </h3>
                      <p className="cartStepCard__helper">
                        Escribí tu dirección real y elegí una opción sugerida para calcular el
                        envío correctamente.
                      </p>
                    </div>

                    <div className="cartContainer__field cartContainer__field--wide">
                      <label>Dirección</label>
                      <AddressAutocomplete
                        value={addressQuery}
                        onChange={setAddressQuery}
                        onSelectAddress={handleAddressSelected}
                        disabled={busy}
                        placeholder="Ej: Rogelio Vidal 3532, General San Martín"
                      />
                    </div>

                    <div className="addressSummary">
                      <div className="addressSummary__row">
                        <span>Calle</span>
                        <strong>{getShortAddress({ streetName, streetNumber }) || "—"}</strong>
                      </div>

                      <div className="addressSummary__row">
                        <span>Ciudad</span>
                        <strong>{city || "—"}</strong>
                      </div>

                      <div className="addressSummary__row">
                        <span>Provincia</span>
                        <strong>{provinceName || "—"}</strong>
                      </div>

                      <div className="addressSummary__row">
                        <span>Código postal</span>
                        <strong>{normalizeZip(postalCode) || "—"}</strong>
                      </div>
                    </div>

                    {/* <div className="shipQuote">
                      <div className="shipQuote__row">
                        <div className="shipQuote__field">
                          <label>Destino</label>

                          <div className="shipQuote__readonly">
                            {provinceName || "—"} · {city || "—"} ·{" "}
                            {postalCode ? normalizeZip(postalCode) : "—"}
                          </div>

                          <small className="shipQuote__hint">
                            {shouldApplyFreeShipping
                              ? "🚚 Tu envío es gratis para esta dirección."
                              : shipStatus === "loading"
                              ? "Calculando envío..."
                              : shipStatus === "ok" && resolvedShipQuote
                              ? "Ya calculamos tu envío con la dirección seleccionada."
                              : "Seleccioná una dirección para calcular el envío automáticamente."}
                          </small>
                        </div>
                      </div>

                      {shipStatus === "error" && shipError ? (
                        <p className="shipQuote__error">{shipError}</p>
                      ) : null}

                      {(shouldApplyFreeShipping || (shipStatus === "ok" && resolvedShipQuote)) ? (
                        <div className="shipQuote__result" role="status" aria-live="polite">
                          <div className="shipQuote__resultTop">
                            <strong>
                              {shouldApplyFreeShipping ? "Envío gratis" : "Envío estándar"}
                            </strong>

                            {shouldApplyFreeShipping
                              ? qualifiesByLocalZip
                                ? " · Retiro / entrega local"
                                : " · Envío incluido"
                              : resolvedShipQuote?.service
                              ? ` · ${resolvedShipQuote.service.replace(/\s*\(tarifa fija\)/i, "")}`
                              : " · A domicilio"}
                          </div>

                          <div className="shipQuote__resultBottom">
                            <div
                              className={`shipQuote__price ${
                                shouldApplyFreeShipping ? "shipQuote__price--free" : ""
                              }`}
                            >
                              {shouldApplyFreeShipping
                                ? "Gratis"
                                : formatARS(resolvedShipQuote?.price || 0)}
                            </div>

                            {!shouldApplyFreeShipping && resolvedShipQuote?.eta ? (
                              <div className="shipQuote__eta">{resolvedShipQuote.eta}</div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div> */}
                    <div className="shipQuote">
                      <div className="shipQuote__row">
                        <div className="shipQuote__field">
                          <label>Destino</label>

                          <div className="shipQuote__readonly">
                            {provinceName || "—"} · {city || "—"} ·{" "}
                            {postalCode ? normalizeZip(postalCode) : "—"}
                          </div>

                          <small className="shipQuote__hint">
                            {shouldApplyFreeShipping
                              ? "🚚 Tu envío es gratis para esta dirección."
                              : shipStatus === "loading"
                              ? "Calculando envío..."
                              : shipStatus === "ok" && resolvedShipQuote
                              ? "Ya calculamos tu envío con la dirección seleccionada."
                              : "Seleccioná una dirección para calcular el envío automáticamente."}
                          </small>
                        </div>
                      </div>

                      {/* ERROR */}
                      {shipStatus === "error" && shipError ? (
                        <p className="shipQuote__error">{shipError}</p>
                      ) : null}

                      {/* LOADING (SPINNER) */}
                      {shipStatus === "loading" ? (
                        <div className="shipQuote__loading">
                          <div className="spinner" />
                          <span>Calculando envío...</span>
                        </div>
                      ) : null}

                      {/* RESULTADO */}
                      {(shouldApplyFreeShipping || (shipStatus === "ok" && resolvedShipQuote)) && shipStatus !== "loading" ? (
                        <div className="shipQuote__result" role="status" aria-live="polite">
                          <div className="shipQuote__resultTop">
                            <strong>
                              {shouldApplyFreeShipping ? "Envío gratis" : "Envío estándar"}
                            </strong>

                            {shouldApplyFreeShipping
                              ? qualifiesByLocalZip
                                ? " · Retiro / entrega local"
                                : " · Envío incluido"
                              : resolvedShipQuote?.service
                              ? ` · ${resolvedShipQuote.service.replace(/\s*\(tarifa fija\)/i, "")}`
                              : " · A domicilio"}
                          </div>

                          <div className="shipQuote__resultBottom">
                            <div
                              className={`shipQuote__price ${
                                shouldApplyFreeShipping ? "shipQuote__price--free" : ""
                              }`}
                            >
                              {shouldApplyFreeShipping
                                ? "Gratis"
                                : formatARS(resolvedShipQuote?.price || 0)}
                            </div>

                            {!shouldApplyFreeShipping && resolvedShipQuote?.eta ? (
                              <div className="shipQuote__eta">{resolvedShipQuote.eta}</div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="cartStepSecurity">
                      <p className="cartStepSecurity__text">
                        🔒 Tus datos están protegidos. Solo los usamos para enviarte tu pedido.
                      </p>
                    </div>
                  </div>

                  <div className="cartTrust">
                    <div className="cartTrust__item">🔒 Pago 100% seguro con Mercado Pago</div>
                    <div className="cartTrust__item">🚚 Envíos a todo el país</div>
                    <div className="cartTrust__item">📦 Despacho en 24/48 hs</div>
                    <div className="cartTrust__item">💬 Soporte por WhatsApp</div>
                  </div>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <div className="cartStepCard">
                    <div className="cartStepCard__head">
                      <h3 className="cartContainer__sectionTitle">
                        3. Detalles finales de entrega
                      </h3>
                      <p className="cartStepCard__helper">
                        Revisá tu dirección y completá los datos finales para que el pedido
                        llegue sin problemas.
                      </p>
                    </div>

                    <div className="addressSummary addressSummary--final">
                      <div className="addressSummary__row">
                        <span>Dirección seleccionada</span>
                        <strong>
                          {getShortAddress({ streetName, streetNumber }) || "—"}
                        </strong>
                      </div>

                      <div className="addressSummary__row">
                        <span>Ciudad</span>
                        <strong>{city || "—"}</strong>
                      </div>

                      <div className="addressSummary__row">
                        <span>Provincia</span>
                        <strong>{provinceName || "—"}</strong>
                      </div>

                      <div className="addressSummary__row">
                        <span>Código postal</span>
                        <strong>{normalizeZip(postalCode) || "—"}</strong>
                      </div>

                      <div className="addressSummary__row">
                        <span>Calle</span>
                        <strong>{streetName || "—"}</strong>
                      </div>

                      <div className="addressSummary__row">
                        <span>Número</span>
                        <strong>{streetNumber || "Falta completar"}</strong>
                      </div>
                    </div>

                    {missingStreetNumber ? (
                      <div className="cartInlineWarning">
                        No encontramos la altura exacta de la dirección. Completala
                        manualmente para poder enviar tu pedido.
                      </div>
                    ) : null}

                    <div className="cartContainer__grid">
                      {missingStreetNumber ? (
                        <div className="cartContainer__field">
                          <label htmlFor="ship_streetNumber">Número / Altura</label>
                          <input
                            id="ship_streetNumber"
                            value={streetNumber}
                            onChange={(e) =>
                              setStreetNumber(e.target.value.replace(/\D/g, ""))
                            }
                            placeholder="Ej: 3532"
                            inputMode="numeric"
                            autoComplete="address-line2"
                          />
                          <small className="cartContainer__fieldHint">
                            Completá la altura para que el correo pueda ubicar correctamente
                            tu dirección.
                          </small>
                        </div>
                      ) : null}

                      <div className="cartContainer__field">
                        <label htmlFor="ship_apt">Piso / Depto (opcional)</label>
                        <input
                          id="ship_apt"
                          value={apt}
                          onChange={(e) => setApt(e.target.value)}
                          placeholder="Ej: 3B"
                          autoComplete="address-line2"
                        />
                      </div>

                      <div className="cartContainer__field">
                        <label htmlFor="ship_dni">DNI (para el envío)</label>
                        <input
                          id="ship_dni"
                          value={dni}
                          onChange={(e) => setDni(onlyDigits(e.target.value))}
                          placeholder="12345678"
                          inputMode="numeric"
                          autoComplete="off"
                        />
                        <small className="cartContainer__fieldHint">
                          Necesario para el envío, requerido por el correo.
                        </small>
                      </div>

                      <div className="cartContainer__field cartContainer__field--wide">
                        <label htmlFor="ship_notes">Referencias (opcional)</label>
                        <input
                          id="ship_notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Portón negro, timbre a la izquierda..."
                          autoComplete="off"
                        />
                        <small className="cartContainer__fieldHint">
                          Sumá una referencia útil para facilitar la entrega.
                        </small>
                      </div>
                    </div>

                    <div className="cartStepDeliveryReady">
                      <div className="cartStepDeliveryReady__item">
                        🚚 Tu pedido ya está listo para pasar al pago
                      </div>
                      <div className="cartStepDeliveryReady__item">
                        📦 Lo despachamos dentro de 24/48 hs
                      </div>
                    </div>
                  </div>

                  {canShowUpsell ? (
                    <>
                      <div className="cartUpsellDivider">
                        <span>Opcional</span>
                      </div>

                      <p className="cartUpsell__intro">Ya que estás ordenando tu cocina…</p>
                      <p className="cartUpsell__intro cartUpsell__intro--strong">
                        💡 Sumalo ahora y aprovechá el mismo envío.
                      </p>

                      <div className="cartUpsell" aria-label="Oferta recomendada">
                        <div className="cartUpsell__badge">PREMIUM</div>

                        <div className="cartUpsell__row">
                          <div className="cartUpsell__imgWrap">
                            <img
                              className="cartUpsell__img"
                              src={upsell.imageUrl}
                              alt={upsell.title}
                              loading="lazy"
                            />
                          </div>

                          <div className="cartUpsell__content">
                            <div className="cartUpsell__title">{upsell.title}</div>
                            <div className="cartUpsell__sub">
                              Aprovechá el mismo envío y completá tu compra con este extra.
                            </div>

                            <div className="cartUpsell__meta">
                              <span className="cartUpsell__price">
                                <div>{formatARS(upsell.price)}</div>
                                <div className="cartUpsell__price__underPrice">
                                  Entra en el mismo envío
                                </div>
                              </span>

                              <span className="cartUpsell__mini">
                                3 cuotas sin interés <br /> de $11.000
                              </span>
                            </div>

                            <div className="cartUpsell__actions">
                              <button
                                type="button"
                                className="cartUpsell__btn cartUpsell__btn--primary"
                                onClick={addUpsell}
                                disabled={busy || upsellBusy}
                              >
                                {upsellBusy ? "Agregando..." : "Sumar a mi compra"}
                              </button>

                              <button
                                type="button"
                                className="cartUpsell__btn cartUpsell__btn--ghost"
                                onClick={() => {
                                  cart.close();
                                  setTimeout(() => {
                                    const el = document.getElementById("upsell");
                                    if (el) {
                                      el.scrollIntoView({
                                        behavior: "smooth",
                                        block: "start",
                                      });
                                    }
                                  }, 120);
                                }}
                                disabled={busy}
                              >
                                Ver
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}

                  <div className="cartTrust">
                    <div className="cartTrust__item">🔒 Pago 100% seguro con Mercado Pago</div>
                    <div className="cartTrust__item">
                      💳 Podés pagar con tarjeta, débito o saldo
                    </div>
                    <div className="cartTrust__item">🚚 Envíos a todo el país</div>
                    <div className="cartTrust__item">💬 Soporte por WhatsApp</div>
                  </div>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <div className="cartStepCard">
                    <div className="cartStepCard__head">
                      <h3 className="cartContainer__sectionTitle">4. Confirmá tu compra</h3>
                      <p className="cartStepCard__helper">
                        Revisá tus datos y finalizá el pago de forma segura.
                      </p>
                    </div>

                    <div className="reviewCard">
                      <div className="reviewCard__block">
                        <div className="reviewCard__title">Productos</div>

                        {cart.items?.length ? (
                          <div className="reviewItems">
                            {cart.items.map((it) => (
                              <div key={it.slug} className="reviewItems__row">
                                <div className="reviewItems__main">
                                  <span className="reviewItems__name">{it.title}</span>
                                  <span className="reviewItems__qty">x{it.qty}</span>
                                </div>

                                <div className="reviewItems__price">
                                  {formatARS(Number(it.price || 0) * Number(it.qty || 0))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p>—</p>
                        )}
                      </div>

                      <div className="reviewCard__block">
                        <div className="reviewCard__title">Contacto</div>
                        <p>{name || "—"}</p>
                        <p>{phone || "—"}</p>
                        <p>{email || "—"}</p>
                      </div>

                      <div className="reviewCard__block">
                        <div className="reviewCard__title">Envío</div>
                        <p>{getShortAddress({ streetName, streetNumber }) || "—"}</p>
                        <p>
                          {city || "—"} · {provinceName || "—"}
                        </p>
                        <p>CP {normalizeZip(postalCode) || "—"}</p>
                        {apt ? <p>Depto / Piso: {apt}</p> : null}
                        <p>DNI {onlyDigits(dni) || "—"}</p>
                        {notes ? <p>Referencia: {notes}</p> : null}
                      </div>

                      <div className="reviewCard__block">
                        <div className="reviewCard__title">Costo de envío</div>

                        {(shouldApplyFreeShipping || resolvedShipQuote) ? (
                          <div className="shipQuote__result" role="status" aria-live="polite">
                            <div className="shipQuote__resultTop">
                              <strong>
                                {shouldApplyFreeShipping ? "Envío gratis" : "Envío estándar"}
                              </strong>

                              {shouldApplyFreeShipping
                                ? qualifiesByLocalZip
                                  ? " · Retiro / entrega local"
                                  : " · Envío incluido"
                                : resolvedShipQuote?.service
                                ? ` · ${resolvedShipQuote.service.replace(/\s*\(tarifa fija\)/i, "")}`
                                : " · A domicilio"}
                            </div>

                            <div className="shipQuote__resultBottom">
                              <div
                                className={`shipQuote__price ${
                                  shouldApplyFreeShipping ? "shipQuote__price--free" : ""
                                }`}
                              >
                                {shouldApplyFreeShipping
                                  ? "Gratis"
                                  : formatARS(resolvedShipQuote?.price || 0)}
                              </div>

                              {!shouldApplyFreeShipping && resolvedShipQuote?.eta ? (
                                <div className="shipQuote__eta">{resolvedShipQuote.eta}</div>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <p>—</p>
                        )}
                      </div>
                    </div>

                    <div className="cartFinalSummary">
                      <div>
                        📦 Recibís en: <strong>{city || "—"}</strong>,{" "}
                        <strong>{provinceName || "—"}</strong>
                      </div>

                      <div>
                        🚚 Entrega estimada:{" "}
                        <strong>{deliveryEtaText}</strong>
                      </div>
                    </div>

                    <div className="cartFinalTrust">
                      <div>🔒 Pago seguro con Mercado Pago</div>
                      <div>💳 Tarjetas, cuotas y dinero en cuenta</div>
                      <div>📦 Despachamos en 24/48 hs</div>
                    </div>

                    <div className="cartFinalNudge">
                      <p className="cartFinalNudge__text">
                        Estás a un paso de completar tu compra ✨
                      </p>
                    </div>

                    <p className="cartFinalNote">
                      No se realizará ningún cargo hasta confirmar el pago en Mercado Pago.
                    </p>

                    <p className="cartFinalUrgency">
                      ⏳ Alta demanda hoy — asegurá tu compra ahora
                    </p>
                  </div>
                </>
              ) : null}

              {err ? (
                <p id="cart_error" className="cartContainer__error">
                  {err}
                </p>
              ) : null}

              <div className="cartContainer__footer">
                <div className="cartContainer__summary">
                  <div className="cartContainer__totalLine">
                    <span>Productos</span>
                    <span>{formatARS(cart.total)}</span>
                  </div>

                  <div className="cartContainer__totalLine">
                    <span>{shippingLineLabel}</span>

                    <div className="cartContainer__shippingSummary">
                      <span>
                        {shouldApplyFreeShipping ? (
                          <span className="cartContainer__shippingFree">Gratis</span>
                        ) : (
                          formatARS(shippingPrice)
                        )}
                      </span>

                      {shippingEtaLabel ? (
                        <small className="cartContainer__shippingEta">
                          {shippingEtaLabel}
                        </small>
                      ) : null}
                    </div>
                  </div>

                  <div className="cartContainer__total">
                    <span>{totalLineLabel}</span>
                    <strong>{formatARS(grandTotal)}</strong>
                  </div>
                </div>

                <div className="cartContainer__footerTrust">
                  <span>🔒 Pago seguro con Mercado Pago</span>
                  <span>🚚 Envíos a todo el país</span>
                </div>

                {step === 1 ? (
                  <div className="cartContainer__footerButtons">
                    <button
                      type="button"
                      onClick={() => {
                        cart.clear();
                        try {
                          sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
                        } catch {
                          // ignore
                        }
                      }}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--ghost"
                    >
                      Vaciar
                    </button>

                    <button
                      type="button"
                      onClick={goNext}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--primary"
                    >
                      Continuar compra →
                    </button>
                  </div>
                ) : step === 2 ? (
                  <div className="cartContainer__footerButtons">
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--ghost"
                    >
                      Volver
                    </button>

                    <button
                      type="button"
                      onClick={goNext}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--primary"
                    >
                      Continuar → Revisar entrega
                    </button>
                  </div>
                ) : step === 3 ? (
                  <div className="cartContainer__footerButtons">
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--ghost"
                    >
                      Volver
                    </button>

                    <button
                      type="button"
                      onClick={goNext}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--confirm"
                    >
                      Confirmar compra
                    </button>
                  </div>
                ) : step === 4 ? (
                  <>
                    <div className="cartContainer__finalHint">
                      Vas a finalizar el pago en Mercado Pago de forma segura.
                    </div>

                    <div className="cartContainer__footerButtons cartContainer__footerButtons--final">
                      <button
                        type="button"
                        onClick={goBack}
                        disabled={busy}
                        className="cartContainer__btn cartContainer__btn--ghost"
                      >
                        Volver
                      </button>

                      <button
                        type="button"
                        onClick={checkout}
                        disabled={busy}
                        className="cartContainer__btn cartContainer__btn--primary cartContainer__btn--pay"
                      >
                        {busy ? "Procesando..." : "Confirmar compra y pagar 🔒"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="cartContainer__footerButtons">
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--ghost"
                    >
                      Volver
                    </button>

                    <button
                      type="button"
                      onClick={goNext}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--primary"
                    >
                      Continuar
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}