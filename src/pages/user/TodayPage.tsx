import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { isOnboardingDone } from "./onboarding/onboardingStorage";

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.10)",
        borderRadius: 16,
        background: "#171717",
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function getStreak() {
  return Number(localStorage.getItem("workout_streak_v1") || "0");
}

function getLastWorkoutId(): string | null {
  try {
    const raw = localStorage.getItem("workout_history_v1");
    if (!raw) return null;
    const list: Array<{ workoutId: string; date: string }> = JSON.parse(raw);
    const last = list[list.length - 1];
    return last?.workoutId ?? null;
  } catch {
    return null;
  }
}

/**
 * ✅ "Lembrar depois" (por usuário) sem reload
 * - some por 24h
 */
const DISMISS_KEY_BASE = "onboarding_v1_banner_dismiss_until";
function dismissKey(userId: string) {
  return `${DISMISS_KEY_BASE}:${(userId ?? "").trim().toLowerCase()}`;
}
function dismissForHours(userId: string, hours = 24) {
  const until = Date.now() + hours * 60 * 60 * 1000;
  localStorage.setItem(dismissKey(userId), String(until));
}
function isDismissed(userId: string) {
  const raw = localStorage.getItem(dismissKey(userId));
  const until = raw ? Number(raw) : 0;
  if (!until) return false;
  return Date.now() < until;
}

export default function TodayPage() {
  const navigate = useNavigate();
  const { id } = useAuth();
  const userId = (id ?? "").trim().toLowerCase();

  const streak = useMemo(() => getStreak(), []);
  const lastWorkoutId = useMemo(() => getLastWorkoutId(), []);

  // ✅ Sugestão simples (mock). Depois troca por IA + recomendação real.
  const suggestedWorkoutId = "home-10min";

  // ✅ controle local para sumir na hora, sem reload
  const [bannerHidden, setBannerHidden] = useState(false);

  useEffect(() => {
    setBannerHidden(false);
  }, [userId]);

  const showOnboardingBanner = useMemo(() => {
    if (!userId) return false;

    // 1) se concluiu onboarding → não mostra
    if (isOnboardingDone(userId)) return false;

    // 2) se clicou em "lembrar depois" e ainda está no TTL → não mostra
    if (isDismissed(userId)) return false;

    // 3) se escondeu nesta sessão → não mostra
    if (bannerHidden) return false;

    return true;
  }, [userId, bannerHidden]);

  return (
    <div style={{ display: "grid", gap: 14, color: "#FFFFFF" }}>
      {showOnboardingBanner ? (
        <Card
          style={{
            border: "1px solid rgba(255,106,0,.25)",
            background: "rgba(255,106,0,.10)",
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 1000, letterSpacing: 0.3 }}>PREENCHA O SEU ONBOARDING</div>

            <div style={{ color: "rgba(255,255,255,.80)", fontSize: 13, lineHeight: 1.35 }}>
              Isso é importante para melhorar a personalização dos seus treinos: objetivo, nível,
              limitações e preferências. Com isso, o app consegue sugerir treinos mais certeiros
              pra você evoluir mais rápido e com segurança.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => navigate("/app/user/onboarding")}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,106,0,.35)",
                  background: "#FF6A00",
                  color: "#0F0F0F",
                  cursor: "pointer",
                  fontWeight: 1000,
                  boxShadow: "0 10px 24px rgba(0,0,0,.35)",
                }}
              >
                ✅ PREENCHER AGORA
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!userId) return;
                  dismissForHours(userId, 24);
                  setBannerHidden(true);
                }}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "transparent",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  fontWeight: 1000,
                }}
              >
                LEMBRAR DEPOIS
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Hoje</div>
            <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
              Seu painel rápido: treino sugerido, streak e atalhos.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 999,
                border: "1px solid rgba(34,197,94,.35)",
                background: "rgba(34,197,94,.12)",
                fontWeight: 1000,
              }}
              title="Dias seguidos treinando"
            >
              🔥 Streak: {streak} dia(s)
            </div>

            <button
              type="button"
              onClick={() => navigate("/app/user/treinos")}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.12)",
                background: "transparent",
                color: "#FFFFFF",
                cursor: "pointer",
                fontWeight: 1000,
              }}
            >
              Ver treinos
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Treino sugerido</div>
          <div style={{ color: "rgba(255,255,255,.70)", fontSize: 13, lineHeight: 1.35 }}>
            Um treino curto pra manter consistência (depois a IA personaliza isso).
          </div>

          <button
            type="button"
            onClick={() => navigate(`/app/user/treinos/player/${suggestedWorkoutId}`)}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,106,0,.35)",
              background: "#FF6A00",
              color: "#0F0F0F",
              cursor: "pointer",
              fontWeight: 1000,
              width: "fit-content",
              boxShadow: "0 10px 24px rgba(0,0,0,.35)",
            }}
          >
            ▶️ Iniciar agora
          </button>

          {lastWorkoutId ? (
            <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,.10)", paddingTop: 10 }}>
              <div style={{ fontWeight: 1000 }}>Continuar / repetir</div>
              <div style={{ color: "rgba(255,255,255,.65)", fontSize: 13, marginTop: 4 }}>
                Último treino feito: <b style={{ color: "#FFFFFF" }}>{lastWorkoutId}</b>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => navigate(`/app/user/treinos/player/${lastWorkoutId}`)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "transparent",
                    color: "#FFFFFF",
                    cursor: "pointer",
                    fontWeight: 1000,
                  }}
                >
                  🔁 Repetir último
                </button>

                <Link
                  to="/app/user/progress"
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "transparent",
                    color: "#FFFFFF",
                    textDecoration: "none",
                    fontWeight: 1000,
                  }}
                >
                  📈 Ver progresso
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}