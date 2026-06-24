import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { submitWaitlistEmail } from "../services/waitlistApi";

/**
 * Landing pública de waitlist B2C (Spec 013).
 *
 * Trilho "pronto, desligado": captura interesse de pessoas que querem o
 * acompanhamento metabólico contínuo (B2C direto). Sem aquisição ativa durante
 * o piloto — a lista só é trabalhada quando os critérios de escala forem batidos.
 * Posicionamento: acompanhamento que adapta à vida real — NUNCA "app de ficha".
 */
export default function WaitlistPage() {
  const [params] = useSearchParams();
  const referral = params.get("ref") || undefined;

  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (state === "submitting") return;
    setError(null);
    setState("submitting");
    try {
      await submitWaitlistEmail(email, { source: "landing", referral });
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tente novamente.");
      setState("idle");
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-eyebrow" style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 8 }}>
          Lista de espera
        </div>

        {state === "done" ? (
          <>
            <h1 className="auth-title">Você está na lista 🎉</h1>
            <p className="auth-subtitle">
              Avisaremos assim que abrirmos vagas. Enquanto isso, seu interesse já nos
              ajuda a priorizar quem entra primeiro.
            </p>
            <div className="auth-links" style={{ marginTop: 24 }}>
              <Link to="/login">Já tem conta? Entrar</Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="auth-title">Seu metabolismo, acompanhado todo dia</h1>
            <p className="auth-subtitle">
              Não é mais um app de treino. É um acompanhamento que lê seus sinais —
              sono, energia, recuperação, alimentação — e adapta sua rotina à sua vida
              real. Entre na lista para ser avisado quando abrirmos.
            </p>

            <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
              <div className="field">
                <label className="label" htmlFor="waitlist-email">
                  Seu melhor e-mail
                </label>
                <input
                  id="waitlist-email"
                  className="input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  required
                />
              </div>

              {error && (
                <div className="auth-error" role="alert" style={{ marginTop: 12 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-block"
                style={{ marginTop: 16 }}
                disabled={state === "submitting"}
              >
                {state === "submitting" ? "Inscrevendo…" : "Quero entrar na lista"}
              </button>
            </form>

            <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 16, lineHeight: 1.5 }}>
              Usamos seu e-mail só para avisar do lançamento. Sem spam, sem venda de
              dados — privacidade é parte do produto.{" "}
              <Link to="/privacidade" style={{ color: "var(--color-primary)" }}>
                Política de privacidade
              </Link>
              .
            </p>

            <div className="auth-links" style={{ marginTop: 20 }}>
              <Link to="/login">Já tem conta? Entrar</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
