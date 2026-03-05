// src/pages/AdminApp.tsx
import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const COLORS = {
  bg: "#0F0F0F",
  panel: "#171717",
  border: "rgba(255,255,255,.10)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.70)",
  orange: "#FF6A00",
  orangeBorder: "rgba(255,106,0,.35)",
};

export default function AdminApp() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [newPass, setNewPass] = useState("");

  // ✅ proteção
  if (!auth.isAuthenticated) return <Navigate to="/login" replace />;
  if (auth.role !== "admin") return <Navigate to="/login" replace />;

  const users = useMemo(() => auth.listUsers(), [auth]);

  function logout() {
    auth.logout();
    navigate("/login", { replace: true });
  }

  function resetToDefault() {
    const res = auth.resetUserPassword(email, "123456");
    alert(res.message);
  }

  function setCustomPassword() {
    const res = auth.resetUserPassword(email, newPass);
    alert(res.message);
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, padding: 22 }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 14 }}>
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            background: COLORS.panel,
            padding: 16,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Admin — Treinaí</div>
            <div style={{ color: COLORS.muted, marginTop: 4 }}>Ferramentas do MVP (mock / localStorage)</div>
          </div>

          <button
            onClick={logout}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              background: "transparent",
              color: COLORS.text,
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Sair
          </button>
        </div>

        {/* Reset de senha */}
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            background: COLORS.panel,
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Reset de senha do usuário</div>
          <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.35 }}>
            Digite o e-mail do usuário e resete a senha para <b>123456</b> ou defina uma senha nova.
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 900, color: "rgba(255,255,255,.85)" }}>Email do usuário</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teste1@treinai.com"
              style={{
                padding: "12px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: "#121212",
                color: COLORS.text,
                outline: "none",
              }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={resetToDefault}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.orangeBorder}`,
                background: COLORS.orange,
                color: "#0F0F0F",
                cursor: "pointer",
                fontWeight: 1000,
              }}
            >
              Resetar para 123456
            </button>

            <div style={{ flex: 1 }} />

            <input
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Nova senha (opcional)"
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: "#121212",
                color: COLORS.text,
                outline: "none",
                minWidth: 220,
              }}
            />
            <button
              onClick={setCustomPassword}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.06)",
                color: COLORS.text,
                cursor: "pointer",
                fontWeight: 1000,
              }}
            >
              Definir senha
            </button>
          </div>
        </div>

        {/* Lista de usuários (somente informativo, não são botões) */}
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            background: COLORS.panel,
            padding: 16,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Usuários no mock</div>
          <div style={{ color: COLORS.muted, fontSize: 13 }}>Apenas para referência (não clicável).</div>

          <div style={{ display: "grid", gap: 8 }}>
            {users.map((u) => (
              <div
                key={u.email}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  background: "rgba(255,255,255,.03)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span style={{ fontWeight: 900 }}>{u.email}</span>
                <span style={{ color: COLORS.muted, fontWeight: 900 }}>{u.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}