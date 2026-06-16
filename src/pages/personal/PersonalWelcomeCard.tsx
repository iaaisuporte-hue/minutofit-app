import { useNavigate } from "react-router-dom";

interface Props {
  firstName: string;
  hasStudents: boolean;
}

type Step = {
  label: string;
  desc: string;
  done: boolean;
  cta: string;
  onClick: () => void;
};

export function PersonalWelcomeCard({ firstName, hasStudents }: Props) {
  const navigate = useNavigate();

  // Card desaparece após os 2 marcos concluídos — a 2ª é subjetiva,
  // então escondemos quando já há alunos (primeiro marco é suficiente).
  if (hasStudents) return null;

  const steps: Step[] = [
    {
      label: "Convide seu primeiro aluno",
      desc: "Envie um link de convite direto — o aluno se cadastra e já fica vinculado a você.",
      done: hasStudents,
      cta: "Convidar por link",
      onClick: () => navigate("/app/personal/students?action=invite"),
    },
    {
      label: "Ative a adaptação automática",
      desc: "No cockpit do aluno → aba Técnica → Adaptação automática. Leva menos de 1 minuto.",
      done: false,
      cta: "Ver como",
      onClick: () => navigate("/app/personal/students"),
    },
  ];

  const done = steps.filter((s) => s.done).length;

  return (
    <div
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-card, 12px)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-md)",
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      <div style={{ height: 3, background: "var(--gradient-primary, linear-gradient(90deg,#22c55e,#06b6d4))" }} />
      <div style={{ padding: 20, display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Primeiros passos · {done}/{steps.length}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)" }}>
            Bem-vindo, {firstName}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            Em 2 passos você tem o loop completo funcionando: check-in do aluno → treino adaptado → você acompanha no cockpit.
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${step.done ? "var(--color-success-soft, #dcfce7)" : "var(--color-border)"}`,
                background: step.done ? "var(--color-success-soft, #f0fdf4)" : "transparent",
                opacity: step.done ? 0.7 : 1,
              }}
            >
              <div
                style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                  background: step.done ? "var(--color-success, #22c55e)" : "var(--color-border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {step.done ? (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)" }}>{i + 1}</span>
                )}
              </div>
              <div style={{ flex: 1, display: "grid", gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{step.label}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.4 }}>{step.desc}</div>
              </div>
              {!step.done && (
                <button
                  type="button"
                  className="pp-btn pp-btn--ghost pp-btn--sm"
                  onClick={step.onClick}
                  style={{ flexShrink: 0, alignSelf: "center" }}
                >
                  {step.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
