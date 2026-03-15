"use client";

import { useState } from "react";

const faqs = [
  {
    q: "¿Los contenedores son herméticos?",
    a: "Sí. Los contenedores cuentan con tapa hermética que ayuda a conservar mejor los alimentos y evitar derrames."
  },
  {
    q: "¿Se pueden apilar?",
    a: "Sí. Están diseñados para apilarse de forma segura, optimizando el espacio en alacena y heladera."
  },
  {
    q: "¿Cómo se limpian?",
    a: "Se limpian fácilmente con agua y detergente. El material es resistente y no retiene olores."
  },

  // 🔥 BLOQUE ENVÍOS ESTRATÉGICO

  {
    q: "¿Cuánto cuesta el envío?",
    a: "Realizamos envíos a todo el país. El costo se calcula automáticamente según tu código postal antes de pagar."
  },
  {
    q: "¿Cuánto tarda en llegar?",
    a: "Despachamos dentro de las 24 a 48 hs hábiles. El tiempo de entrega final es de 2 a 7 días hábiles según tu ubicación."
  },
  {
    q: "¿Con qué correo envían?",
    a: "Trabajamos con Correo Argentino o Andreani, ambos con seguimiento para que puedas ver el estado de tu pedido en todo momento."
  },
  {
    q: "¿Puedo hacer seguimiento de mi pedido?",
    a: "Sí. Una vez despachado, recibirás un número de seguimiento para ver el estado de tu envío."
  },

  {
    q: "¿Tienen cambios o devoluciones?",
    a: "Sí. Podés solicitar cambio o devolución dentro de los 10 días desde que lo recibís. Escribinos por WhatsApp y te ayudamos enseguida."
  }
];

export function FAQ() {
  const [open, setOpen] = useState(null);

  const toggle = (i) => {
    setOpen(open === i ? null : i);
  };

  return (
    <section className="faqContainer" id="faq">
      <h2 className="faqContainer__title">Preguntas frecuentes</h2>

      <ul className="faqContainer__list">
        {faqs.map((item, i) => (
          <li
            key={i}
            className={`faqItem ${open === i ? "faqItem--open" : ""}`}
          >
            <button
              className="faqItem__question"
              onClick={() => toggle(i)}
              aria-expanded={open === i}
            >
              <span>{item.q}</span>
              <span className="faqItem__icon">
                {open === i ? "−" : "+"}
              </span>
            </button>

            <div className="faqItem__answer">
              <p>{item.a}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
