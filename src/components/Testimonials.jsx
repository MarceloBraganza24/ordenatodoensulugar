export function Testimonials() {
  return (
    <section className="testimonialsContainer" id="opiniones">
      <h2 className="testimonialsContainer__title">Lo que dicen nuestros clientes</h2>
      <p className="testimonialsContainer__subtitle">Compras reales. Cocinas mas ordenadas.</p>
      <p className="testimonialsContainer__badge">⭐ 5/5 según nuestros clientes</p>

      <ul className="testimonialsContainer__ul">
        <li className="testimonialsContainer__ul__li">
          <p className="testimonialsContainer__ul__li__stars">⭐⭐⭐⭐⭐</p>
          <p className="testimonialsContainer__ul__li__title"><strong>“Me cambió la heladera”.</strong></p>
          <p className="testimonialsContainer__ul__li__text">Se ve todo, se apilan genial y queda súper prolijo.</p>
          <p className="testimonialsContainer__ul__li__name">Sofi – Córdoba.</p>
        </li>
        <li className="testimonialsContainer__ul__li">
          <p className="testimonialsContainer__ul__li__stars">⭐⭐⭐⭐⭐</p>
          <p className="testimonialsContainer__ul__li__title"><strong>“No se vuelca nada, re herméticos”.</strong></p>
          <p className="testimonialsContainer__ul__li__text">Los uso para harina y cereales, cero derrames.</p>
          <p className="testimonialsContainer__ul__li__name">Caro – Buenos Aires.</p>
        </li>
        <li className="testimonialsContainer__ul__li">
          <p className="testimonialsContainer__ul__li__stars">⭐⭐⭐⭐⭐</p>
          <p className="testimonialsContainer__ul__li__title"><strong>“Se apilan perfecto”.</strong></p>
          <p className="testimonialsContainer__ul__li__text">Ahorro un montón de espacio en alacena y heladera.</p>
          <p className="testimonialsContainer__ul__li__name">Meli – Rosario.</p>
        </li>
      </ul>
    </section>
  );
}
