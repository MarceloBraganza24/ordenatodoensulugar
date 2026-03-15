"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data?.error || "Error");
      return;
    }

    const nextUrl = new URLSearchParams(window.location.search).get("next");
    router.push(nextUrl || "/admin/orders");

  };

  return (
    <main className="adminLogin">
      <h1 className="adminLogin__title">Login admin</h1>

      <form className="adminLogin__form" onSubmit={submit}>
        <div className="adminLogin__field">
          <label className="adminLogin__label">Usuario</label>
          <input
            className="adminLogin__input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="adminLogin__field">
          <label className="adminLogin__label">Contraseña</label>
          <input
            className="adminLogin__input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button className="adminLogin__button" type="submit">
          Entrar
        </button>
      </form>

      {msg ? <p className="adminLogin__msg">{msg}</p> : null}
    </main>

  );
}
