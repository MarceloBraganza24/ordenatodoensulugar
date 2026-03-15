/* "use client";

import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/context/CartContext";
import { formatARS } from "@/lib/money";
import { startCheckout } from "@/lib/clientCheckout";

const FREE_SHIPPING_THRESHOLD = 45000;
const FREE_SHIPPING_PRODUCT_SLUGS = ["pack-completo"];

const ORIGIN_ZIP =
  String(process.env.NEXT_PUBLIC_CA_POSTAL_ORIGIN || "")
    .replace(/\D/g, "")
    .slice(0, 4);

function isFreeShippingZip(destZip, provinceCode) {
  const dz = String(destZip || "").replace(/\D/g, "").slice(0, 4);

  return (
    provinceCode === "B" &&
    ORIGIN_ZIP &&
    dz &&
    dz === ORIGIN_ZIP
  );
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

const onlyDigits = (s) => (s || "").replace(/\D/g, "");
const isValidEmail = (email) => !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhoneSoft = (phone) => {
  const digits = onlyDigits(phone);
  return digits.length >= 10 && digits.length <= 15;
};

const normalizeZip = (v) => onlyDigits(v).slice(0, 8);
const isValidZip = (v) => normalizeZip(v).length >= 4;

function getFlatShippingQuote({ provinceCode }) {
  const p = String(provinceCode || "").toUpperCase().trim();

  if (p === "B" || p === "C") {
    return {
      carrier: "Envío estándar",
      service: "A domicilio (tarifa fija)",
      price: 6900,
      eta: "3 a 7 días hábiles",
      deliveredType: "D",
      mode: "flat",
    };
  }

  const patagonia = ["R", "Q", "U", "Z", "V"];
  if (patagonia.includes(p)) {
    return {
      carrier: "Envío estándar",
      service: "A domicilio (tarifa fija)",
      price: 11900,
      eta: "4 a 10 días hábiles",
      deliveredType: "D",
      mode: "flat",
    };
  }

  return {
    carrier: "Envío estándar",
    service: "A domicilio (tarifa fija)",
    price: 8900,
    eta: "3 a 9 días hábiles",
    deliveredType: "D",
    mode: "flat",
  };
}

export function CartDrawer() {
  const cart = useCart();

  const [isDesktop, setIsDesktop] = useState(false);
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);

  // Buyer
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Shipping - step 1 (mínimo para cotizar)
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Shipping - step 2 (final antes de pagar)
  const [streetName, setStreetName] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [apt, setApt] = useState("");
  const [dni, setDni] = useState("");
  const [notes, setNotes] = useState("");

  // UI
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Flow UI
  const [showFinalAddressFields, setShowFinalAddressFields] = useState(false);

  // Upsell
  const [upsell, setUpsell] = useState(null);
  const [upsellBusy, setUpsellBusy] = useState(false);

  // Shipping quote
  const [shipQuote, setShipQuote] = useState(null);
  const [shipStatus, setShipStatus] = useState("idle"); // idle | loading | ok | error
  const [shipError, setShipError] = useState("");

  const qualifiesByAmount = cart.total >= FREE_SHIPPING_THRESHOLD;
  const remainingForFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - cart.total, 0);

  const freeShippingProgress = Math.min(
    (cart.total / FREE_SHIPPING_THRESHOLD) * 100,
    100
  );

  const hasFreeShippingProduct = cart.items.some((it) =>
    FREE_SHIPPING_PRODUCT_SLUGS.includes(it.slug)
  );

  const zip = normalizeZip(postalCode);
  const qualifiesByLocalZip = isFreeShippingZip(zip, province);

  const shouldApplyFreeShipping =
    hasFreeShippingProduct || qualifiesByAmount || qualifiesByLocalZip;

  const scrollToField = (id) => {
    if (!id) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof el.focus === "function") el.focus();
    });
  };

  const provinceName = useMemo(() => {
    const found = PROVINCES_AR.find((p) => p.code === province);
    return found ? found.name : "";
  }, [province]);

  const itemsSig = useMemo(() => {
    return cart.items.map((it) => `${it.slug}:${it.qty}`).sort().join("|");
  }, [cart.items]);

  useEffect(() => {
    if (!cart.isOpen) return;
    if (!shipQuote) return;

    if (shouldApplyFreeShipping && shipQuote.price !== 0) {
      setShipQuote({
        carrier: "Gratis",
        service: hasFreeShippingProduct
          ? "(incluido en este pack)"
          : qualifiesByLocalZip
          ? "(retiro en Coronel Suárez)"
          : `(gratis desde ${formatARS(FREE_SHIPPING_THRESHOLD)})`,
        price: 0,
        eta: "",
        mode: "free",
      });
      setShipStatus("ok");
    }
  }, [
    cart.isOpen,
    shipQuote,
    shouldApplyFreeShipping,
    hasFreeShippingProduct,
    qualifiesByLocalZip,
    qualifiesByAmount,
  ]);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!cart.isOpen) return;
    if (!shipQuote) return;
    if (shipQuote?.mode === "flat") return;

    setShipQuote(null);
    setShipStatus("idle");
    setShipError("El carrito cambió. Volvé a cotizar el envío.");
    setShowFinalAddressFields(false);
  }, [cart.isOpen, itemsSig]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (cart.isOpen) {
      setShowCheckoutForm(false);
      setShowFinalAddressFields(false);
      setErr("");
    }
  }, [cart.isOpen]);

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
      setTimeout(() => {
        if (shipQuote) quoteShipping();
      }, 240);
    }
  };

  useEffect(() => {
    if (shipQuote) {
      setShipQuote(null);
      setShipStatus("idle");
      setShowFinalAddressFields(false);
    }
  }, [province, postalCode]);

  async function quoteShipping() {
    setErr("");
    setShipError("");
    setShipStatus("idle");
    setShipQuote(null);
    setShowFinalAddressFields(false);

    if (!province) {
      setShipStatus("error");
      setShipError("Seleccioná una provincia para cotizar.");
      scrollToField("ship_province");
      return;
    }

    const zip = normalizeZip(postalCode);

    if (!isValidZip(zip)) {
      setShipStatus("error");
      setShipError("Ingresá un código postal válido (mínimo 4 dígitos).");
      scrollToField("ship_postalCode");
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
    const qualifiesByLocalZipNow = isFreeShippingZip(zip, province);

    if (hasFreeShippingProductInCart || qualifiesByAmountNow || qualifiesByLocalZipNow) {
      let service = "(incluido en tu compra)";

      if (qualifiesByLocalZipNow) {
        service = "(retiro en Coronel Suárez)";
      } else if (qualifiesByAmountNow) {
        service = `(gratis desde ${formatARS(FREE_SHIPPING_THRESHOLD)})`;
      } else if (hasFreeShippingProductInCart) {
        service = "(incluido en este pack)";
      }

      setShipQuote({
        carrier: "Gratis",
        service,
        price: 0,
        eta: "",
        mode: "free",
      });
      setShipStatus("ok");
      setShowFinalAddressFields(true);

      setTimeout(() => {
        scrollToField("ship_streetName");
      }, 120);

      return;
    }

    setShipStatus("loading");

    if (hasFreeShippingProductInCart) {
      setShipQuote({
        carrier: "Gratis",
        service: "(incluido en tu compra)",
        price: 0,
        eta: "",
        mode: "free-product",
      });
      setShipStatus("ok");
      setShowFinalAddressFields(true);

      setTimeout(() => {
        scrollToField("ship_streetName");
      }, 120);

      return;
    }

    try {
      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postalCode: zip,
          deliveredType: "D",
          items: cart.items.map((it) => ({ slug: it.slug, qty: it.qty })),
          destination: {
            province,
            city: city?.trim() || null,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo cotizar.");

      setShipQuote(data.quote);
      setShipStatus("ok");
      setShowFinalAddressFields(true);

      setTimeout(() => {
        scrollToField("ship_streetName");
      }, 120);
    } catch (e) {
      const msg = String(e?.message || "");

      if (
        msg.toLowerCase().includes("faltan credenciales") ||
        msg.toLowerCase().includes("no disponible")
      ) {
        const q = getFlatShippingQuote({ provinceCode: province });
        setShipQuote(q);
        setShipStatus("ok");
        setShowFinalAddressFields(true);

        setTimeout(() => {
          scrollToField("ship_streetName");
        }, 120);

        return;
      }

      setShipStatus("error");
      setShipError(msg || "No pudimos cotizar el envío. Probá de nuevo.");
    }
  }

  const shippingPrice = shouldApplyFreeShipping ? 0 : (shipQuote?.price || 0);
  const grandTotal = cart.total + shippingPrice;

  const validateBuyerAndQuote = () => {
    if (!cart.items.length) return { msg: "Tu carrito está vacío.", fieldId: "" };

    if (!name.trim()) return { msg: "Ingresá tu nombre y apellido.", fieldId: "buyer_name" };
    if (!phone.trim()) return { msg: "Ingresá tu teléfono (WhatsApp).", fieldId: "buyer_phone" };
    if (!isValidPhoneSoft(phone)) {
      return { msg: "Revisá el teléfono (10 a 15 dígitos aprox.).", fieldId: "buyer_phone" };
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

    if (!province) return { msg: "Seleccioná una provincia.", fieldId: "ship_province" };
    if (!city.trim()) return { msg: "Ingresá tu ciudad/localidad.", fieldId: "ship_city" };
    if (!postalCode.trim()) {
      return { msg: "Ingresá el código postal.", fieldId: "ship_postalCode" };
    }
    if (!/^\d{4,8}$/.test(onlyDigits(postalCode))) {
      return {
        msg: "El código postal debe ser numérico (ej: 7540).",
        fieldId: "ship_postalCode",
      };
    }

    if (!shipQuote) {
      return {
        msg: "Tocá “Cotizar envío” para ver el costo antes de continuar.",
        fieldId: "ship_quote_btn",
      };
    }

    return { msg: "", fieldId: "" };
  };

  const validateFinalAddress = () => {
    if (!streetName.trim()) return { msg: "Ingresá la calle.", fieldId: "ship_streetName" };
    if (!streetNumber.trim()) return { msg: "Ingresá el número.", fieldId: "ship_streetNumber" };

    if (!dni.trim()) return { msg: "Ingresá tu DNI (lo pide el correo).", fieldId: "ship_dni" };
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
      },
    };
  }, [name, phone, email, province, city, postalCode, streetName, streetNumber, apt, dni, notes]);

  const checkout = async () => {
    setErr("");

    const buyerAndQuote = validateBuyerAndQuote();
    if (buyerAndQuote.msg) {
      setErr(buyerAndQuote.msg);
      if (buyerAndQuote.fieldId) scrollToField(buyerAndQuote.fieldId);
      return;
    }

    const finalAddress = validateFinalAddress();
    if (finalAddress.msg) {
      setErr(finalAddress.msg);
      if (finalAddress.fieldId) scrollToField(finalAddress.fieldId);
      return;
    }

    setBusy(true);
    try {
      await startCheckout(
        cart.items.map((it) => ({ slug: it.slug, qty: it.qty })),
        buyer,
        {
          shipping: shipQuote,
          zip: normalizeZip(postalCode),
        }
      );
    } catch (e) {
      console.error("checkout error:", e);
      setErr("No se pudo iniciar el pago. Probá de nuevo.");
      setBusy(false);
      scrollToField("cart_error");
    }
  };

  const handlePrimaryAction = () => {
    setErr("");

    if (!showCheckoutForm) {
      setShowCheckoutForm(true);
      setTimeout(() => {
        scrollToField("buyer_name");
      }, 80);
      return;
    }

    if (!showFinalAddressFields) {
      const { msg, fieldId } = validateBuyerAndQuote();
      if (msg) {
        setErr(msg);
        if (fieldId) scrollToField(fieldId);
        return;
      }

      setErr("");
      setTimeout(() => {
        scrollToField("ship_quote_btn");
      }, 80);
      return;
    }

    checkout();
  };

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
        <div className="cartContainer" role="dialog" aria-modal="true" aria-label="Carrito">
          <div className="cartContainer__header">
            <h2 className="cartContainer__title">Tu carrito</h2>
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
              <ul className="cartContainer__items">
                {cart.items.map((it) => (
                  <li key={it.slug} className="cartItem">
                    <div className="cartItem__info">
                      <strong className="cartItem__title">{it.title}</strong>
                      <div className="cartItem__price">{formatARS(it.price)} c/u</div>
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

              <div className="freeShippingProgress" aria-live="polite">
                {hasFreeShippingProduct ? (
                  <p className="freeShippingProgress__text freeShippingProgress__text--ok">
                    🚚 Tu compra incluye envío gratis
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
                  <p className="freeShippingProgress__text">
                    Te faltan solo <strong>{formatARS(remainingForFreeShipping)}</strong> para obtener
                    envío gratis
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
                    style={{ width: `${shouldApplyFreeShipping ? 100 : freeShippingProgress}%` }}
                  />
                </div>

                {!shouldApplyFreeShipping ? (
                  <small className="freeShippingProgress__hint">
                    Envío gratis desde {formatARS(FREE_SHIPPING_THRESHOLD)}
                  </small>
                ) : null}
              </div>

              {canShowUpsell ? (
                <>
                  <div className="cartUpsellDivider">
                    <span>Opcional</span>
                  </div>

                  <p className="cartUpsell__intro">Ya que estás ordenando tu cocina…</p>
                  <p className="cartUpsell__intro">
                    Completá el cambio con el cubiertero de bambú.
                  </p>
                </>
              ) : null}

              {canShowUpsell ? (
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
                        Ya que estás ordenando… aprovechá el envío y sumá el cubiertero de bambú.
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
                              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
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
              ) : null}

              {showCheckoutForm ? (
                <>
                  <div className="cartContainer__divider" />

                  <h3 className="cartContainer__sectionTitle">Datos del comprador</h3>

                  <div className="cartContainer__grid">
                    <div className="cartContainer__field">
                      <label>Nombre y apellido</label>
                      <input
                        id="buyer_name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tu nombre"
                        autoComplete="name"
                        inputMode="text"
                      />
                    </div>

                    <div className="cartContainer__field">
                      <label>Teléfono (WhatsApp)</label>
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
                      <label>Email</label>
                      <input
                        id="buyer_email"
                        value={email}
                        type="email"
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@..."
                        autoComplete="email"
                        inputMode="email"
                      />
                    </div>
                  </div>

                  <h3 className="cartContainer__sectionTitle">Cotizar envío</h3>

                  <div className="cartContainer__grid">
                    <div className="cartContainer__field">
                      <label>Provincia</label>
                      <select
                        id="ship_province"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        autoComplete="address-level1"
                      >
                        <option value="" disabled>
                          Seleccioná una provincia
                        </option>
                        {PROVINCES_AR.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="cartContainer__field">
                      <label>Ciudad / Localidad</label>
                      <input
                        id="ship_city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Tu ciudad"
                        autoComplete="address-level2"
                      />
                    </div>

                    <div className="cartContainer__field">
                      <label>Código postal</label>
                      <input
                        id="ship_postalCode"
                        value={postalCode}
                        onChange={(e) => setPostalCode(onlyDigits(e.target.value))}
                        placeholder="Ej: 7540"
                        autoComplete="postal-code"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div className="shipQuote">
                    <div className="shipQuote__row">
                      <div className="shipQuote__field">
                        <label>Destino</label>
                        <div className="shipQuote__readonly">
                          {provinceName || "—"} {provinceName ? `(${province})` : ""} ·{" "}
                          {postalCode ? normalizeZip(postalCode) : "—"}
                        </div>
                        <small className="shipQuote__hint">
                          Usamos la provincia y el CP para calcular el envío.
                        </small>
                      </div>

                      <button
                        id="ship_quote_btn"
                        type="button"
                        className="shipQuote__btn"
                        onClick={quoteShipping}
                        disabled={busy || shipStatus === "loading"}
                      >
                        {shipStatus === "loading"
                          ? "Cotizando..."
                          : shipQuote?.mode === "free"
                          ? "Envío gratis"
                          : "Cotizar envío"}
                      </button>
                    </div>

                    {shipStatus === "error" && shipError ? (
                      <p className="shipQuote__error">{shipError}</p>
                    ) : null}

                    {shipStatus === "ok" && shipQuote ? (
                      <div className="shipQuote__result" role="status" aria-live="polite">
                        <div className="shipQuote__resultTop">
                          <strong>{shipQuote.carrier}</strong> · {shipQuote.service}
                        </div>

                        <div className="shipQuote__resultBottom">
                          <div className="shipQuote__price">
                            {shipQuote.price === 0 ? "" : formatARS(shipQuote.price)}
                          </div>
                          <div className="shipQuote__eta">{shipQuote.eta}</div>
                        </div>
                      </div>
                    ) : null}

                    {shipQuote?.mode === "flat" ? (
                      <small
                        className="shipQuote__hint"
                        style={{ display: "block", marginTop: 8, opacity: 0.85 }}
                      >
                        Tarifa estimada por provincia. En zonas muy alejadas el costo puede variar;
                        te confirmamos antes de despachar.
                      </small>
                    ) : null}
                  </div>

                  {showFinalAddressFields ? (
                    <>
                      <h3 className="cartContainer__sectionTitle">Dirección final de entrega</h3>

                      <div className="cartContainer__grid">
                        <div className="cartContainer__field cartContainer__field--wide">
                          <label>Calle</label>
                          <input
                            id="ship_streetName"
                            value={streetName}
                            onChange={(e) => setStreetName(e.target.value)}
                            placeholder="Av. Siempre Viva"
                            autoComplete="address-line1"
                          />
                        </div>

                        <div className="cartContainer__field">
                          <label>Número</label>
                          <input
                            id="ship_streetNumber"
                            value={streetNumber}
                            onChange={(e) => setStreetNumber(e.target.value.replace(/\D/g, ""))}
                            placeholder="123"
                            inputMode="numeric"
                            autoComplete="address-line2"
                          />
                        </div>

                        <div className="cartContainer__field">
                          <label>Piso / Depto (opcional)</label>
                          <input
                            value={apt}
                            onChange={(e) => setApt(e.target.value)}
                            placeholder="3B"
                            autoComplete="address-line2"
                          />
                        </div>

                        <div className="cartContainer__field">
                          <label>DNI (para el envío)</label>
                          <input
                            id="ship_dni"
                            value={dni}
                            onChange={(e) => setDni(onlyDigits(e.target.value))}
                            placeholder="12345678"
                            inputMode="numeric"
                            autoComplete="off"
                          />
                        </div>

                        <div className="cartContainer__field cartContainer__field--wide">
                          <label>Referencias (opcional)</label>
                          <input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Portón negro, timbre a la izquierda..."
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div
                      className="cartContainer__divider"
                      style={{ marginTop: 16, paddingTop: 16 }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          lineHeight: 1.45,
                          opacity: 0.85,
                        }}
                      >
                        Primero cotizá el envío con tu provincia y código postal. Después te vamos a
                        pedir la dirección exacta para completar el pedido.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div
                  className="cartContainer__divider"
                  style={{ marginTop: 16, paddingTop: 16 }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.45,
                      opacity: 0.85,
                    }}
                  >
                    Completá tus datos, cotizá el envío y pagá en el siguiente paso. Te va a llevar
                    menos de un minuto.
                  </p>
                </div>
              )}

              {err ? (
                <p id="cart_error" className="cartContainer__error">
                  {err}
                </p>
              ) : null}

              <div className="cartContainer__footer">
                <div className="cartContainer__totalLine">Productos: {formatARS(cart.total)}</div>
                <div className="cartContainer__totalLine">
                  Envío: {shouldApplyFreeShipping ? "Gratis" : shipQuote ? formatARS(shippingPrice) : "—"}
                </div>
                <div className="cartContainer__total">
                  <strong>Total: {formatARS(grandTotal)}</strong>
                </div>

                {!showCheckoutForm ? (
                  <div className="cartContainer__footerButtons">
                    <button
                      type="button"
                      onClick={cart.clear}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--ghost"
                    >
                      Vaciar
                    </button>

                    <button
                      type="button"
                      onClick={handlePrimaryAction}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--primary"
                    >
                      Completar datos y pagar
                    </button>
                  </div>
                ) : !showFinalAddressFields ? (
                  <div className="cartContainer__footerButtons">
                    <button
                      type="button"
                      onClick={() => {
                        setErr("");
                        setShowCheckoutForm(false);
                        setShipQuote(null);
                        setShipStatus("idle");
                        setShipError("");
                      }}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--ghost"
                    >
                      Volver
                    </button>

                    <button
                      type="button"
                      onClick={handlePrimaryAction}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--primary"
                    >
                      Continuar
                    </button>
                  </div>
                ) : (
                  <div className="cartContainer__footerButtons">
                    <button
                      type="button"
                      onClick={() => {
                        setErr("");
                        setShowFinalAddressFields(false);
                      }}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--ghost"
                    >
                      Volver
                    </button>

                    <button
                      type="button"
                      onClick={handlePrimaryAction}
                      disabled={busy}
                      className="cartContainer__btn cartContainer__btn--primary"
                    >
                      {busy ? "Procesando..." : "Finalizar compra"}
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
} */






"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/context/CartContext";
import { formatARS } from "@/lib/money";
import { startCheckout } from "@/lib/clientCheckout";

const FREE_SHIPPING_THRESHOLD = 45000;
const FREE_SHIPPING_PRODUCT_SLUGS = ["pack-completo"];

const ORIGIN_ZIP =
  String(process.env.NEXT_PUBLIC_CA_POSTAL_ORIGIN || "")
    .replace(/\D/g, "")
    .slice(0, 4);

function isFreeShippingZip(destZip, provinceCode) {
  const dz = String(destZip || "").replace(/\D/g, "").slice(0, 4);

  return (
    provinceCode === "B" && // Buenos Aires
    ORIGIN_ZIP &&
    dz &&
    dz === ORIGIN_ZIP
  );
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

const onlyDigits = (s) => (s || "").replace(/\D/g, "");
const isValidEmail = (email) => !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhoneSoft = (phone) => {
  const digits = onlyDigits(phone);
  return digits.length >= 10 && digits.length <= 15;
};

const normalizeZip = (v) => onlyDigits(v).slice(0, 8);
const isValidZip = (v) => normalizeZip(v).length >= 4;

// Tarifa fallback (hasta tener credenciales)
function getFlatShippingQuote({ provinceCode }) {
  const p = String(provinceCode || "").toUpperCase().trim();

  if (p === "B" || p === "C") {
    return {
      carrier: "Envío estándar",
      service: "A domicilio (tarifa fija)",
      price: 6900,
      eta: "3 a 7 días hábiles",
      deliveredType: "D",
      mode: "flat",
    };
  }

  const patagonia = ["R", "Q", "U", "Z", "V"];
  if (patagonia.includes(p)) {
    return {
      carrier: "Envío estándar",
      service: "A domicilio (tarifa fija)",
      price: 11900,
      eta: "4 a 10 días hábiles",
      deliveredType: "D",
      mode: "flat",
    };
  }

  return {
    carrier: "Envío estándar",
    service: "A domicilio (tarifa fija)",
    price: 8900,
    eta: "3 a 9 días hábiles",
    deliveredType: "D",
    mode: "flat",
  };
}

export function CartDrawer() {
  const cart = useCart();

  const [isDesktop, setIsDesktop] = useState(false);

  // Buyer
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Shipping address
  const [province, setProvince] = useState(""); // guarda code (B,C,X,...)
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [streetName, setStreetName] = useState("");
  const [streetNumber, setStreetNumber] = useState("");

  const [apt, setApt] = useState("");
  const [dni, setDni] = useState("");
  const [notes, setNotes] = useState("");

  // UI
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Upsell
  const [upsell, setUpsell] = useState(null);
  const [upsellBusy, setUpsellBusy] = useState(false);

  // Shipping quote (real cuando exista, sino usamos flat al cotizar)
  const [shipQuote, setShipQuote] = useState(null);
  const [shipStatus, setShipStatus] = useState("idle"); // idle | loading | ok | error
  const [shipError, setShipError] = useState("");

  const qualifiesByAmount = cart.total >= FREE_SHIPPING_THRESHOLD;
  const remainingForFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - cart.total, 0);

  const freeShippingProgress = Math.min(
    (cart.total / FREE_SHIPPING_THRESHOLD) * 100,
    100
  );

  const hasFreeShippingProduct = cart.items.some((it) =>
    FREE_SHIPPING_PRODUCT_SLUGS.includes(it.slug)
  );

  const zip = normalizeZip(postalCode);
  const qualifiesByLocalZip = isFreeShippingZip(zip, province);

  const shouldApplyFreeShipping =
  hasFreeShippingProduct || qualifiesByAmount || qualifiesByLocalZip;

  // -------- scroll-to-invalid --------
  const scrollToField = (id) => {
    if (!id) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof el.focus === "function") el.focus();
    });
  };

  const provinceName = useMemo(() => {
    const found = PROVINCES_AR.find((p) => p.code === province);
    return found ? found.name : "";
  }, [province]);

  // Para invalidar cotización real cuando cambian items (sin romper flat)
  const itemsSig = useMemo(() => {
    return cart.items.map((it) => `${it.slug}:${it.qty}`).sort().join("|");
  }, [cart.items]);

  useEffect(() => {
    if (!cart.isOpen) return;
    if (!shipQuote) return;

    if (shouldApplyFreeShipping && shipQuote.price !== 0) {
      setShipQuote({
        carrier: "Gratis",
        service: hasFreeShippingProduct
          ? "(incluido en este pack)"
          : qualifiesByLocalZip
            ? "(retiro en Coronel Suárez)"
            : `(gratis desde ${formatARS(FREE_SHIPPING_THRESHOLD)})`,
        price: 0,
        eta: "",
        mode: "free",
      });
      setShipStatus("ok");
    }
  }, [
    cart.isOpen,
    shipQuote,
    shouldApplyFreeShipping,
    hasFreeShippingProduct,
    qualifiesByLocalZip,
    qualifiesByAmount,
  ]);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!cart.isOpen) return;

    // Si no hay quote, nada
    if (!shipQuote) return;

    // Si es flat, no depende del carrito
    if (shipQuote?.mode === "flat") return;

    // Si fuera real, invalidamos para que no quede un precio desactualizado
    setShipQuote(null);
    setShipStatus("idle");
    setShipError("El carrito cambió. Volvé a cotizar el envío.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.isOpen, itemsSig]);

  // Traer upsell desde /api/products (cuando se abre el carrito)
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
      // si ya había cotización (flat o real), recotizamos automáticamente
      setTimeout(() => {
        if (shipQuote) quoteShipping();
      }, 240);
    }
  };

  useEffect(() => {
    // cuando cambia provincia o CP, se invalida la cotización
    if (shipQuote) {
      setShipQuote(null);
      setShipStatus("idle");
    }
  }, [province, postalCode]);

  async function quoteShipping() {
    setShipError("");
    setShipStatus("idle");
    setShipQuote(null);

    if (!province) {
      setShipStatus("error");
      setShipError("Seleccioná una provincia para cotizar.");
      scrollToField("ship_province");
      return;
    }

    const zip = normalizeZip(postalCode);

    if (!isValidZip(zip)) {
      setShipStatus("error");
      setShipError("Ingresá un código postal válido (mínimo 4 dígitos).");
      scrollToField("ship_postalCode");
      return;
    }

    if (!cart.items.length) {
      setShipStatus("error");
      setShipError("Tu carrito está vacío.");
      return;
    }

    // ✅ ENVÍO GRATIS por pack, monto o zona local
    const hasFreeShippingProductInCart = cart.items.some((it) =>
      FREE_SHIPPING_PRODUCT_SLUGS.includes(it.slug)
    );

    const qualifiesByAmountNow = cart.total >= FREE_SHIPPING_THRESHOLD;
    const qualifiesByLocalZipNow = isFreeShippingZip(zip, province);

    if (hasFreeShippingProductInCart || qualifiesByAmountNow || qualifiesByLocalZipNow) {
      let service = "(incluido en tu compra)";

      if (qualifiesByLocalZipNow) {
        service = "(retiro en Coronel Suárez)";
      } else if (qualifiesByAmountNow) {
        service = `(gratis desde ${formatARS(FREE_SHIPPING_THRESHOLD)})`;
      } else if (hasFreeShippingProductInCart) {
        service = "(incluido en este pack)";
      }

      setShipQuote({
        carrier: "Gratis",
        service,
        price: 0,
        eta: "",
        mode: "free",
      });
      setShipStatus("ok");
      return;
    }

    setShipStatus("loading");

    if (hasFreeShippingProductInCart) {
      setShipQuote({
        carrier: "Gratis",
        service: "(incluido en tu compra)",
        price: 0,
        eta: "",
        mode: "free-product",
      });
      setShipStatus("ok");
      return;
    }

    try {
      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postalCode: zip,
          deliveredType: "D",
          items: cart.items.map((it) => ({ slug: it.slug, qty: it.qty })),
          destination: {
            province, // code
            city: city?.trim() || null,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No se pudo cotizar.");

      setShipQuote(data.quote);
      setShipStatus("ok");
    } catch (e) {
      // Fallback local si la API no está lista o falla
      const msg = String(e?.message || "");

      // Si todavía no está configurado (o querés siempre fallback), mostramos tarifa fija
      if (msg.toLowerCase().includes("faltan credenciales") || msg.toLowerCase().includes("no disponible")) {
        const q = getFlatShippingQuote({ provinceCode: province });
        setShipQuote(q);
        setShipStatus("ok");
        return;
      }

      setShipStatus("error");
      setShipError(msg || "No pudimos cotizar el envío. Probá de nuevo.");
    }
  }

  const shippingPrice = shouldApplyFreeShipping ? 0 : (shipQuote?.price || 0);
  const grandTotal = cart.total + shippingPrice;

  // Validación (devuelve { msg, fieldId })
  const validate = () => {
    if (!cart.items.length) return { msg: "Tu carrito está vacío.", fieldId: "" };

    if (!name.trim()) return { msg: "Ingresá tu nombre y apellido.", fieldId: "buyer_name" };
    if (!phone.trim()) return { msg: "Ingresá tu teléfono (WhatsApp).", fieldId: "buyer_phone" };
    if (!isValidPhoneSoft(phone)) return { msg: "Revisá el teléfono (10 a 15 dígitos aprox.).", fieldId: "buyer_phone" };
    if (!email.trim()) return { msg: "El email es obligatorio para enviarte el seguimiento del pedido.", fieldId: "buyer_email" };
    if (!isValidEmail(email.trim())) return { msg: "Email inválido.", fieldId: "buyer_email" };

    if (!province) return { msg: "Seleccioná una provincia.", fieldId: "ship_province" };
    if (!city.trim()) return { msg: "Ingresá tu ciudad/localidad.", fieldId: "ship_city" };
    if (!postalCode.trim()) return { msg: "Ingresá el código postal.", fieldId: "ship_postalCode" };
    if (!/^\d{4,8}$/.test(onlyDigits(postalCode))) return { msg: "El código postal debe ser numérico (ej: 7540).", fieldId: "ship_postalCode" };

    if (!streetName.trim()) return { msg: "Ingresá la calle.", fieldId: "ship_streetName" };
    if (!streetNumber.trim()) return { msg: "Ingresá el número.", fieldId: "ship_streetNumber" };

    if (!dni.trim()) return { msg: "Ingresá tu DNI (lo pide el correo).", fieldId: "ship_dni" };
    if (!/^\d{7,9}$/.test(onlyDigits(dni))) return { msg: "DNI inválido (7 a 9 dígitos).", fieldId: "ship_dni" };

    // ✅ Exigimos que haya cotización confirmada por botón
    if (!shipQuote) return { msg: "Tocá “Cotizar envío” para ver el costo antes de finalizar.", fieldId: "ship_quote_btn" };

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
      },
    };
  }, [name, phone, email, province, city, postalCode, streetName, streetNumber, apt, dni, notes]);

  const checkout = async () => {
    setErr("");

    const { msg, fieldId } = validate();
    if (msg) {
      setErr(msg);
      if (fieldId) scrollToField(fieldId);
      return;
    }

    setBusy(true);
    try {
      await startCheckout(
        cart.items.map((it) => ({ slug: it.slug, qty: it.qty })),
        buyer,
        {
          shipping: shipQuote,
          zip: normalizeZip(postalCode),
        }
      );
    } catch (e) {
      console.error("checkout error:", e);
      setErr("No se pudo iniciar el pago. Probá de nuevo.");
      setBusy(false);
      scrollToField("cart_error");
    }
  };

  // Lock scroll when open
  useEffect(() => {
    if (!cart.isOpen) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [cart.isOpen]);

  // Close on ESC
  useEffect(() => {
    if (!cart.isOpen) return;
    const onKey = (e) => e.key === "Escape" && cart.close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart.isOpen, cart.close]);

  if (!cart.isOpen) return null;

  return (
    <div className="cartOverlay" onClick={!isDesktop ? cart.close : undefined} aria-hidden={!cart.isOpen}>
      <div className="cartPanel" role="dialog" aria-modal="true" aria-label="Carrito" onClick={(e) => e.stopPropagation()}>
        <div className="cartContainer" role="dialog" aria-modal="true" aria-label="Carrito">
          <div className="cartContainer__header">
            <h2 className="cartContainer__title">Tu carrito</h2>
            <button className="cartContainer__close" type="button" onClick={cart.close} disabled={busy}>
              Cerrar
            </button>
          </div>

          {cart.items.length === 0 ? (
            <p className="cartContainer__empty">Tu carrito está vacío.</p>
          ) : (
            <>
              <ul className="cartContainer__items">
                {cart.items.map((it) => (
                  <li key={it.slug} className="cartItem">
                    <div className="cartItem__info">
                      <strong className="cartItem__title">{it.title}</strong>
                      <div className="cartItem__price">{formatARS(it.price)} c/u</div>
                    </div>

                    <div className="cartItem__actions">
                      <div className="cartItem__qty">
                        <button type="button" onClick={() => cart.dec(it.slug)} disabled={busy} aria-label="Disminuir">
                          -
                        </button>
                        <span aria-label="Cantidad">{it.qty}</span>
                        <button type="button" onClick={() => cart.inc(it.slug)} disabled={busy} aria-label="Aumentar">
                          +
                        </button>
                      </div>

                      <button className="cartItem__remove" type="button" onClick={() => cart.removeItem(it.slug)} disabled={busy}>
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="cartContainer__divider" />

              <div className="freeShippingProgress" aria-live="polite">
                {hasFreeShippingProduct ? (
                  <p className="freeShippingProgress__text freeShippingProgress__text--ok">
                    🚚 Tu compra incluye envío gratis
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
                  <p className="freeShippingProgress__text">
                    Te faltan solo <strong>{formatARS(remainingForFreeShipping)}</strong> para obtener envío gratis
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
                    style={{ width: `${shouldApplyFreeShipping ? 100 : freeShippingProgress}%` }}
                  />
                </div>

                {!shouldApplyFreeShipping ? (
                  <small className="freeShippingProgress__hint">
                    Envío gratis desde {formatARS(FREE_SHIPPING_THRESHOLD)}
                  </small>
                ) : null}
              </div>

              <h3 className="cartContainer__sectionTitle">Datos del comprador</h3>

              <div className="cartContainer__grid">
                <div className="cartContainer__field">
                  <label>Nombre y apellido</label>
                  <input
                    id="buyer_name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    autoComplete="name"
                    inputMode="text"
                  />
                </div>

                <div className="cartContainer__field">
                  <label>Teléfono (WhatsApp)</label>
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
                  <label>Email</label>
                  <input
                    id="buyer_email"
                    value={email}
                    type="email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@..."
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
              </div>

              <h3 className="cartContainer__sectionTitle">Dirección de envío</h3>

              <div className="cartContainer__grid">
                <div className="cartContainer__field">
                  <label>Provincia</label>
                  <select id="ship_province" value={province} onChange={(e) => setProvince(e.target.value)} autoComplete="address-level1">
                    <option value="" disabled>
                      Seleccioná una provincia
                    </option>
                    {PROVINCES_AR.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cartContainer__field">
                  <label>Ciudad / Localidad</label>
                  <input id="ship_city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Tu ciudad" autoComplete="address-level2" />
                </div>

                <div className="cartContainer__field">
                  <label>Código postal</label>
                  <input
                    id="ship_postalCode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(onlyDigits(e.target.value))}
                    placeholder="Ej: 7540"
                    autoComplete="postal-code"
                    inputMode="numeric"
                  />
                </div>

                <div className="cartContainer__field cartContainer__field--wide">
                  <label>Calle</label>
                  <input id="ship_streetName" value={streetName} onChange={(e) => setStreetName(e.target.value)} placeholder="Av. Siempre Viva" autoComplete="address-line1" />
                </div>

                <div className="cartContainer__field">
                  <label>Número</label>
                  <input
                    id="ship_streetNumber"
                    value={streetNumber}
                    onChange={(e) => setStreetNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="123"
                    inputMode="numeric"
                    autoComplete="address-line2"
                  />
                </div>

                <div className="cartContainer__field">
                  <label>Piso / Depto (opcional)</label>
                  <input value={apt} onChange={(e) => setApt(e.target.value)} placeholder="3B" autoComplete="address-line2" />
                </div>

                <div className="cartContainer__field">
                  <label>DNI (para el envío)</label>
                  <input
                    id="ship_dni"
                    value={dni}
                    onChange={(e) => setDni(onlyDigits(e.target.value))}
                    placeholder="12345678"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>

                <div className="cartContainer__field cartContainer__field--wide">
                  <label>Referencias (opcional)</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Portón negro, timbre a la izquierda..." autoComplete="off" />
                </div>
              </div>

              <h3 className="cartContainer__sectionTitle">Cotizar envío</h3>

              <div className="shipQuote">
                <div className="shipQuote__row">
                  <div className="shipQuote__field">
                    <label>Destino</label>
                    <div className="shipQuote__readonly">
                      {provinceName || "—"} {provinceName ? `(${province})` : ""} · {postalCode ? normalizeZip(postalCode) : "—"}
                    </div>
                    <small className="shipQuote__hint">Usamos la provincia y el CP de tu dirección.</small>
                  </div>

                  <button
                    id="ship_quote_btn"
                    type="button"
                    className="shipQuote__btn"
                    onClick={quoteShipping}
                    disabled={busy || shipStatus === "loading"}
                  >
                    {shipStatus === "loading"
                      ? "Cotizando..."
                      : shipQuote?.mode === "free"
                        ? "Envío gratis"
                        : "Cotizar envío"}
                  </button>
                </div>

                {shipStatus === "error" && shipError ? <p className="shipQuote__error">{shipError}</p> : null}

                {shipStatus === "ok" && shipQuote ? (
                  <div className="shipQuote__result" role="status" aria-live="polite">
                    <div className="shipQuote__resultTop">
                      <strong>{shipQuote.carrier}</strong> · {shipQuote.service}
                    </div>

                    <div className="shipQuote__resultBottom">
                      <div className="shipQuote__price">
                        {shipQuote.price === 0 ? "" : formatARS(shipQuote.price)}
                      </div>
                      <div className="shipQuote__eta">{shipQuote.eta}</div>
                    </div>
                  </div>
                ) : null}

                {shipQuote?.mode === "flat" ? (
                  <small className="shipQuote__hint" style={{ display: "block", marginTop: 8, opacity: 0.85 }}>
                    Tarifa estimada por provincia. En zonas muy alejadas el costo puede variar; te confirmamos antes de despachar.
                  </small>
                ) : null}
              </div>

              {canShowUpsell ? (
                <>
                  <div className="cartUpsellDivider">
                    <span>Opcional</span>
                  </div>

                  <p className="cartUpsell__intro">Ya que estás ordenando tu cocina…</p>
                  <p className="cartUpsell__intro">Completá el cambio con el cubiertero de bambú.</p>
                </>
              ) : null}

              {canShowUpsell ? (
                <div className="cartUpsell" aria-label="Oferta recomendada">
                  <div className="cartUpsell__badge">PREMIUM</div>

                  <div className="cartUpsell__row">
                    <div className="cartUpsell__imgWrap">
                      <img className="cartUpsell__img" src={upsell.imageUrl} alt={upsell.title} loading="lazy" />
                    </div>

                    <div className="cartUpsell__content">
                      <div className="cartUpsell__title">{upsell.title}</div>
                      <div className="cartUpsell__sub">Ya que estás ordenando… aprovechá el envío y sumá el cubiertero de bambú.</div>

                      <div className="cartUpsell__meta">
                        <span className="cartUpsell__price">
                          <div>{formatARS(upsell.price)}</div>
                          <div className="cartUpsell__price__underPrice">Entra en el mismo envío</div>
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
                              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
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
              ) : null}

              {err ? (
                <p id="cart_error" className="cartContainer__error">
                  {err}
                </p>
              ) : null}

              <div className="cartContainer__footer">
                <div className="cartContainer__totalLine">Productos: {formatARS(cart.total)}</div>
                <div className="cartContainer__totalLine">
                  Envío: {shouldApplyFreeShipping ? "Gratis" : shipQuote ? formatARS(shippingPrice) : "—"}
                </div>
                <div className="cartContainer__total">
                  <strong>Total: {formatARS(grandTotal)}</strong>
                </div>

                <div className="cartContainer__footerButtons">
                  <button type="button" onClick={cart.clear} disabled={busy} className="cartContainer__btn cartContainer__btn--ghost">
                    Vaciar
                  </button>

                  <button type="button" onClick={checkout} disabled={busy} className="cartContainer__btn cartContainer__btn--primary">
                    {busy ? "Procesando..." : "Finalizar compra"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}