import { useState } from "react";
import { useAuth, type AcademyForUser } from "../auth/AuthContext";

interface Props {
  onSelected?: () => void;
}

/**
 * Seletor de academia — exibido após login quando o usuário tem >1 academia ativa.
 * Chama switchAcademy e redireciona via onSelected callback.
 */
export default function AcademySelector({ onSelected }: Props) {
  const { academies, switchAcademy } = useAuth();
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!academies || academies.length <= 1) return null;

  async function handleSelect(academy: AcademyForUser) {
    setError(null);
    setLoading(academy.id);
    const result = await switchAcademy(academy.id);
    setLoading(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSelected?.();
  }

  return (
    <div className="auth-card" style={{ maxWidth: 420 }}>
      <h2 className="auth-title" style={{ marginBottom: "var(--space-1)" }}>Selecione a academia</h2>
      <p className="auth-subtitle" style={{ marginBottom: "var(--space-6)" }}>
        Você tem acesso a mais de uma academia. Escolha com qual deseja trabalhar agora.
      </p>

      {error && (
        <div className="auth-error" role="alert" style={{ marginBottom: "var(--space-4)" }}>
          {error}
        </div>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {academies.map((academy) => (
          <li key={academy.id}>
            <button
              className="btn btn-secondary btn-block"
              onClick={() => handleSelect(academy)}
              disabled={loading !== null}
              aria-busy={loading === academy.id}
              style={{ justifyContent: "flex-start", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)" }}
            >
              {academy.logoUrl ? (
                <img
                  src={academy.logoUrl}
                  alt=""
                  width={32}
                  height={32}
                  style={{ borderRadius: "var(--radius-sm)", objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    width: 32, height: 32, borderRadius: "var(--radius-sm)",
                    background: "var(--color-primary-soft)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 600, color: "var(--color-primary)",
                    flexShrink: 0,
                  }}
                >
                  {academy.displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span style={{ textAlign: "left" }}>
                <span style={{ display: "block", fontWeight: 500, color: "var(--color-text-primary)" }}>
                  {academy.displayName}
                </span>
                <span style={{ display: "block", fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
                  {academy.roleLabel}
                </span>
              </span>
              {loading === academy.id && (
                <span className="dash-skeleton-bar" style={{ width: 16, height: 16, borderRadius: "50%", marginLeft: "auto" }} />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
