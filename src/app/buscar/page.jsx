"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BuscarPedidoPage() {
  const router = useRouter();

  const [step, setStep] = useState("email"); // email | code
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const requestOtp = async () => {
    setMsg("");
    setBusy(true);

    const res = await fetch("/api/public/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setBusy(false);

    if (!res.ok) {
      setMsg("No pudimos enviar el código. Revisá el email.");
      return;
    }

    setStep("code");
    setMsg("Te enviamos un código por email (vence en 10 minutos).");
  };

  const verifyOtp = async () => {
    setMsg("");
    setBusy(true);

    const res = await fetch("/api/public/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    setBusy(false);

    if (!res.ok) {
      setMsg("Código inválido o expirado.");
      return;
    }

    router.push("/mis-pedidos-online");
  };

  return (
    <main className="otpPage">

      <div className="otpCard">

        <h1 className="otpTitle">Buscar mi pedido</h1>

        {step === "email" ? (
          <>
            <p className="otpSubtitle">
              Ingresá tu email para recibir un código y ver tus pedidos.
            </p>

            <div className="otpField">
              <label>Email</label>
              <input
                value={email}
                type="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tuemail@..."
              />
            </div>

            <button
              type="button"
              className="otpButton otpButton--primary"
              onClick={requestOtp}
              disabled={busy}
            >
              {busy ? "Enviando..." : "Enviar código"}
            </button>
          </>
        ) : (
          <>
            <p className="otpSubtitle">
              Ingresá el código que te llegó por email.
            </p>

            <div className="otpField">
              <label>Código (6 dígitos)</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
            </div>

            <button
              type="button"
              className="otpButton otpButton--primary"
              onClick={verifyOtp}
              disabled={busy}
            >
              {busy ? "Verificando..." : "Ver mis pedidos"}
            </button>

            <button
              type="button"
              className="otpButton otpButton--secondary"
              onClick={() => { setStep("email"); setCode(""); setMsg(""); }}
              disabled={busy}
            >
              Cambiar email
            </button>
          </>
        )}

        {msg ? (
          <p className="otpMessage">{msg}</p>
        ) : null}

        <p className="otpBack">
          <a href="/">Volver al inicio</a>
        </p>

      </div>
    </main>

  );
}
