"use client";

import { useState } from "react";

function AccordionItem({ id, title, children, openId, setOpenId }) {
  const isOpen = openId === id;

  return (
    <div className={`legalAcc__item ${isOpen ? "isOpen" : ""}`}>
      <button
        type="button"
        className="legalAcc__trigger"
        onClick={() => setOpenId(isOpen ? "" : id)}
        aria-expanded={isOpen}
        aria-controls={`panel-${id}`}
      >
        <span className="legalAcc__title">{title}</span>
        <span className="legalAcc__chev" aria-hidden="true">›</span>
      </button>

      <div
        id={`panel-${id}`}
        className="legalAcc__panel"
        role="region"
        aria-label={title}
      >
        <div className="legalAcc__panelInner">{children}</div>
      </div>
    </div>
  );
}

export function LegalSections() {
  const [openId, setOpenId] = useState("");

  // Form arrepentimiento
  const [orderCode, setOrderCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dni, setDni] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  const submitRegret = async () => {
    setMsg("");
    setSending(true);

    try {
      const res = await fetch("/api/public/arrepentimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: orderCode.trim(),
          name: name.trim(),
          email: email.trim(),
          dni: (dni || "").replace(/\D/g, ""),
          reason: reason.trim()
        }),
      });

      if (!res.ok) {
        setMsg("No pudimos enviar tu solicitud. Revisá los datos e intentá de nuevo.");
        setSending(false);
        return;
      }

      setMsg("Listo. Recibimos tu solicitud de arrepentimiento. Te vamos a responder a la brevedad.");
      setOrderCode(""); setName(""); setEmail(""); setDni(""); setReason("");
    } catch {
      setMsg("Hubo un error de conexión. Probá de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="legalSections">
      {/* Quienes */}
      <section className="legalCard" id="quienes">
        <h2 className="legalCard__h">Quiénes somos</h2>
        <p className="legalCard__p">
          En <strong>ORDENA</strong> creamos soluciones prácticas para organizar tu cocina: productos funcionales,
          resistentes y fáciles de usar para que tu heladera, alacena y cajones queden prolijos en minutos.
          Trabajamos con <strong>stock propio</strong> y hacemos <strong>envíos a todo el país</strong>.
        </p>
      </section>

      {/* Contacto */}
      <section className="legalCard" id="contacto">
        <h2 className="legalCard__h">Contacto</h2>
        <p className="legalCard__p">Escribinos y te ayudamos con tu compra o tu envío.</p>

        <div className="legalContact">
          <div className="legalContact__row">
            <span className="legalContact__label">WhatsApp</span>
            <a className="legalContact__link" href="https://wa.me/5492926459172" target="_blank" rel="noreferrer">
              +54 9 2926459172
            </a>
          </div>

          <div className="legalContact__row">
            <span className="legalContact__label">Email</span>
            <a className="legalContact__link" href="mailto:hola@ordena.com">
              ordenatodoensulugar@gmail.com
            </a>
          </div>

          <div className="legalContact__row">
            <span className="legalContact__label">Horario</span>
            <span className="legalContact__value">Lun a Vie · 9:00 a 18:00</span>
          </div>
        </div>

      </section>

      {/* Acordeón legal */}
      <section className="legalAccWrap">
        <h2 className="legalAccWrap__h">Información legal</h2>
        <div className="legalAcc">

          <div id="tyc">
            <AccordionItem id="tyc" title="Términos y condiciones" openId={openId} setOpenId={setOpenId}>
              <div className="legalAcc__bullets">
                <div className="legalAcc__b"><strong>Compra:</strong> al confirmarse el pago, recibirás un email con el detalle del pedido.</div>
                <div className="legalAcc__b"><strong>Medios de pago:</strong> Mercado Pago (según disponibilidad: tarjetas, saldo, transferencia).</div>
                <div className="legalAcc__b"><strong>Despacho:</strong> 24 a 48 hs hábiles desde la confirmación del pago.</div>
                <div className="legalAcc__b"><strong>Envíos:</strong> el tiempo de entrega depende del correo y tu ubicación.</div>
                <div className="legalAcc__b"><strong>Datos:</strong> el comprador es responsable de cargar correctamente datos de contacto y envío.</div>
                <div className="legalAcc__b"><strong>Stock:</strong> sujeto a disponibilidad. Si hubiera un inconveniente, te contactamos.</div>
              </div>
            </AccordionItem>
          </div>

          <div id="privacidad">
            <AccordionItem id="privacidad" title="Política de privacidad" openId={openId} setOpenId={setOpenId}>
              <p className="legalAcc__p">
                Usamos tus datos (nombre, teléfono, email, dirección y DNI si corresponde) solo para gestionar tu compra,
                coordinar el envío y enviarte actualizaciones del pedido.
              </p>
              <div className="legalAcc__bullets">
                <div className="legalAcc__b"><strong>Seguridad:</strong> aplicamos medidas razonables para proteger la información.</div>
                <div className="legalAcc__b"><strong>Derechos:</strong> podés solicitar modificación o eliminación escribiendo a nuestro email.</div>
              </div>
            </AccordionItem>
          </div>

          <div id="cambios">
            <AccordionItem id="cambios" title="Cambios y devoluciones" openId={openId} setOpenId={setOpenId}>
              <p className="legalAcc__p">
                Si tu pedido llegó con algún problema o querés gestionar un cambio/devolución,
                escribinos por WhatsApp indicando tu número de pedido.
              </p>
              <div className="legalAcc__bullets">
                <div className="legalAcc__b"><strong>Plazo:</strong> 10 días desde la recepción.</div>
                <div className="legalAcc__b"><strong>Condición:</strong> sin uso y en estado original (salvo fallas).</div>
                <div className="legalAcc__b"><strong>Envío:</strong> si es falla del producto, nos hacemos cargo.</div>
              </div>
            </AccordionItem>
          </div>

          <div id="arrepentimiento">
            <AccordionItem id="arrepentimiento" title="Botón de arrepentimiento" openId={openId} setOpenId={setOpenId}>
              <p className="legalAcc__p">
                Si realizaste una compra online, podés ejercer tu derecho de arrepentimiento dentro de los 10 días corridos
                desde la recepción del producto (defensa del consumidor).
              </p>

              <div className="regretForm">
                <div className="regretForm__grid">
                  <div className="regretForm__field">
                    <label>Número de pedido (opcional)</label>
                    <input value={orderCode} onChange={(e) => setOrderCode(e.target.value)} placeholder="Ej: AB1234" />
                  </div>
                  <div className="regretForm__field">
                    <label>Nombre y apellido</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
                  </div>
                  <div className="regretForm__field regretForm__field--wide">
                    <label>Email</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tuemail@..." />
                  </div>
                  <div className="regretForm__field">
                    <label>DNI</label>
                    <input value={dni} onChange={(e) => setDni(e.target.value)} placeholder="12345678" inputMode="numeric" />
                  </div>
                  <div className="regretForm__field regretForm__field--wide">
                    <label>Motivo (opcional)</label>
                    <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contanos brevemente" />
                  </div>
                </div>

                <button
                  type="button"
                  className="regretForm__btn"
                  onClick={submitRegret}
                  disabled={sending || !name.trim() || !email.trim()}
                >
                  {sending ? "Enviando..." : "Enviar solicitud"}
                </button>

                {msg ? <p className="regretForm__msg">{msg}</p> : null}
              </div>
            </AccordionItem>
          </div>

        </div>
      </section>
    </section>
  );
}
