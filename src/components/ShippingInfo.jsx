export default function ShippingInfo() {
  return (
    <section className="shippingSection">
      <h3>📦 Envíos nacionales</h3>

      <ul>
        <li>Correo Argentino (estándar con seguimiento).</li>
        <li>Entrega estimada: 3 a 7 días hábiles.</li>
        <li>El costo se calcula automáticamente según tu código postal antes de pagar.</li>
      </ul>

      <div className="shippingSection__hint">
        🔥 Llevando packs, amortizás mejor el envío.
      </div>
    </section>
  );
}
