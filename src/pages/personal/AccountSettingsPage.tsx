import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../components/Toast";

export default function AccountSettingsPage() {
  const { email: authEmail } = useAuth();
  const toast = useToast();

  const [name, setName] = useState("Personal Trainer");
  const [email, setEmail] = useState(authEmail ?? "personal@email.com");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  function saveProfile() {
    if (!name.trim()) return void toast.error("Informe seu nome.");
    if (!email.trim() || !email.includes("@")) return void toast.error("Informe um e-mail válido.");

    toast.info("Configuração salva (simulada). Integração com API em breve.");
  }

  function changePassword() {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return void toast.error("Preencha todos os campos de senha.");
    }
    if (newPassword.length < 8) return void toast.error("A nova senha deve ter pelo menos 8 caracteres.");
    if (newPassword !== confirmNewPassword) return void toast.error("Confirmação de senha não confere.");

    toast.info("Alteração de senha estará disponível quando o fluxo completo de backend for ativado.");

    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h2>Configurações da conta</h2>

      <div style={{ display: "grid", gap: 16 }}>
        {/* Perfil */}
        <div className="card">
          <div className="card-body" style={{ display: "grid", gap: 12 }}>
            <h3>Perfil</h3>

            <div className="field">
              <label className="label">Nome</label>
              <input
                className="input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="label">E-mail</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button className="btn btn-primary" onClick={saveProfile}>
              Salvar perfil
            </button>
          </div>
        </div>

        {/* Senha */}
        <div className="card">
          <div className="card-body" style={{ display: "grid", gap: 12 }}>
            <h3>Alterar senha</h3>

            <div className="field">
              <label className="label">Senha atual</label>
              <input
                className="input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="field">
              <label className="label">Nova senha</label>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="field">
              <label className="label">Confirmar nova senha</label>
              <input
                className="input"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <button className="btn btn-primary" onClick={changePassword}>
              Alterar senha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
