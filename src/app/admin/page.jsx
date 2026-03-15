export default function AdminIndex() {
  return (
    <main className="adminHome">
      <h1 className="adminHome__title">Admin</h1>

      <div className="adminHome__links">
        <a className="adminHome__card" href="/admin/orders">
          <span className="adminHome__cardTitle">Órdenes</span>
          <span className="adminHome__cardDesc">
            Ver y gestionar pedidos
          </span>
        </a>

        <a className="adminHome__card" href="/admin/analytics">
          <span className="adminHome__cardTitle">Analytics</span>
          <span className="adminHome__cardDesc">
            Métricas y rendimiento
          </span>
        </a>

        <a className="adminHome__card adminHome__card--secondary" href="/admin/login">
          <span className="adminHome__cardTitle">Login</span>
          <span className="adminHome__cardDesc">
            Ingresar al panel
          </span>
        </a>
      </div>
    </main>
  );
}
