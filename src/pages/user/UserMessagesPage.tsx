import { useMemo, useState } from "react";

type Msg = { id: string; from: "me" | "coach"; text: string; ts: string };

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

export default function UserMessagesPage() {
  const [text, setText] = useState("");

  const [msgs, setMsgs] = useState<Msg[]>(
    useMemo(
      () => [
        { id: "1", from: "coach", text: "Vamos pra cima hoje! Faz o treino de 10 min e me diz como foi. 💪", ts: new Date().toISOString() },
      ],
      []
    )
  );

  function send() {
    const t = text.trim();
    if (!t) return;
    setMsgs((prev) => [...prev, { id: String(Date.now()), from: "me", text: t, ts: new Date().toISOString() }]);
    setText("");

    // mock resposta do coach
    window.setTimeout(() => {
      setMsgs((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          from: "coach",
          text: "Boa! Quando terminar, manda um ✅ aqui. Se doer algo estranho, me fala.",
          ts: new Date().toISOString(),
        },
      ]);
    }, 600);
  }

  return (
    <div style={{ display: "grid", gap: 14, color: "#FFFFFF" }}>
      <Card title="Mensagens com seu treinador">
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["✅ Fiz o treino", "⏳ Vou fazer mais tarde", "😓 Tive dificuldade"].map((quick) => (
              <button
                key={quick}
                onClick={() => setText(quick)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "rgba(255,255,255,.03)",
                  color: "#FFFFFF",
                  cursor: "pointer",
                  fontWeight: 1000,
                }}
              >
                {quick}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gap: 8, maxHeight: 420, overflow: "auto", paddingRight: 6 }}>
            {msgs.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: m.from === "me" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: 620,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,.10)",
                    background: m.from === "me" ? "rgba(255,106,0,.18)" : "rgba(255,255,255,.04)",
                    fontWeight: 800,
                    lineHeight: 1.35,
                  }}
                >
                  {m.text}
                  <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,.55)" }}>
                    {new Date(m.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Digite sua mensagem..."
              style={{
                flex: 1,
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.03)",
                color: "#FFFFFF",
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />

            <button
              onClick={send}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,106,0,.35)",
                background: "#FF6A00",
                color: "#0F0F0F",
                cursor: "pointer",
                fontWeight: 1000,
              }}
            >
              Enviar
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}