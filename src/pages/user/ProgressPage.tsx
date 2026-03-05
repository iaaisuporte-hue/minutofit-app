import { useMemo } from "react";

type HistoryItem = { workoutId: string; date: string };

function readHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem("workout_history_v1");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getStreak() {
  return Number(localStorage.getItem("workout_streak_v1") || "0");
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.10)",
        borderRadius: 16,
        background: "#171717",
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,.08)", fontWeight: 1000 }}>{title}</div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

export default function ProgressPage() {
  const streak = useMemo(() => getStreak(), []);
  const history = useMemo(() => readHistory().slice().reverse(), []);

  const total = history.length;

  const badges = useMemo(() => {
    const out: string[] = [];
    if (total >= 1) out.push("✅ Primeira sessão");
    if (total >= 5) out.push("🏅 5 treinos");
    if (total >= 10) out.push("🏆 10 treinos");
    if (streak >= 3) out.push("🔥 3 dias seguidos");
    if (streak >= 7) out.push("🚀 7 dias seguidos");
    return out;
  }, [total, streak]);

  return (
    <div style={{ display: "grid", gap: 14, color: "#FFFFFF" }}>
      <Card title="Resumo">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.03)",
                fontWeight: 1000,
              }}
            >
              📌 Total de treinos: {total}
            </div>

            <div
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(34,197,94,.35)",
                background: "rgba(34,197,94,.12)",
                fontWeight: 1000,
              }}
            >
              🔥 Streak: {streak} dia(s)
            </div>
          </div>

          {badges.length ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {badges.map((b) => (
                <span
                  key={b}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,106,0,.30)",
                    background: "rgba(255,106,0,.14)",
                    fontWeight: 1000,
                    fontSize: 12,
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ color: "rgba(255,255,255,.65)", fontSize: 13 }}>
              Faça seu primeiro treino para ver conquistas aqui.
            </div>
          )}
        </div>
      </Card>

      <Card title="Histórico">
        {history.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,.65)", fontSize: 13 }}>Sem histórico ainda.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {history.slice(0, 30).map((h, idx) => (
              <div
                key={`${h.date}-${idx}`}
                style={{
                  border: "1px solid rgba(255,255,255,.10)",
                  borderRadius: 14,
                  background: "#141414",
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 1000 }}>{h.workoutId}</div>
                <div style={{ color: "rgba(255,255,255,.65)", fontSize: 13 }}>
                  {new Date(h.date).toLocaleString("pt-BR")}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}