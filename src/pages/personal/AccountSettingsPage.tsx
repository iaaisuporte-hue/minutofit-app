import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";

export default function AccountSettingsPage() {
  const { email: authEmail } = useAuth();

  const [name, setName] = useState("Personal Trainer");
  const [email, setEmail] = useState(authEmail ?? "personal@email.com");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  function saveProfile() {
    if (!name.trim()) return alert("Informe seu nome.");
    if (!email.trim() || !email.includes("@")) return alert("Informe um e-mail válido.");

    // Aqui NÃO salvamos em lugar nenhum ainda (sem API).
    alert("Configuração salva (placeholder). Próxima fase: integrar API com segurança.");
  }

  function changePassword() {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return alert("Preencha todos os campos de senha.");
    }
    if (newPassword.length < 8) return alert("A nova senha deve ter pelo menos 8 caracteres.");
    if (newPassword !== confirmNewPassword) return alert("Confirmação de senha não confere.");

    // IMPORTANTE: NÃO tentar “salvar senha” no front.
    // A senha deve ir para um endpoint seguro e ser armazenada com hash no servidor.
    alert(
      "Alteração de senha (placeholder). Para ativar de verdade, precisamos do backend (hash + validação + rate limit)."
    );

    // Limpa os campos sempre
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h2>Configurações da conta</h2>

      <div style={{ display: "grid", gap: 16 }}>
        <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Dados do cadastro</h3>

          <div style={{ display: "grid", gap: 10 }}>
            <label>
              Nome
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>

            <label>
              E-mail
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>

            <button
              onClick={saveProfile}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #eee",
                background: "#fff",
                cursor: "pointer",
                width: "fit-content",
              }}
            >
              Salvar dados
            </button>

            <div style={{ color: "#666", fontSize: 13 }}>
              Segurança: a plataforma <b>nunca</b> exibe senhas e não salva senha no navegador.
              Alterações reais (email/senha) devem ser feitas via API segura.
            </div>
          </div>
        </section>

        <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Alterar senha</h3>

          <div style={{ display: "grid", gap: 10 }}>
            <label>
              Senha atual
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
                autoComplete="current-password"
              />
            </label>

            <label>
              Nova senha
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
                autoComplete="new-password"
              />
            </label>

            <label>
              Confirmar nova senha
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
                autoComplete="new-password"
              />
            </label>

            <button
              onClick={changePassword}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #eee",
                background: "#fff",
                cursor: "pointer",
                width: "fit-content",
              }}
            >
              Solicitar alteração de senha
            </button>

            <div style={{ color: "#666", fontSize: 13 }}>
              A senha deve ser tratada apenas no servidor (hash + validação). Nenhuma senha fica salva no front.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}