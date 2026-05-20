import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { DrawerShell } from "../../../components/overlay/DrawerShell";
import {
  addStudentDirect,
  fetchPersonalDashboard,
  type PersonalDashboardStudent,
} from "../../../services/personalDashboardApi";
import { COLORS } from "../../../styles/colors";

type Props = {
  open: boolean;
  onClose: () => void;
  onStudentsRefresh: (students: PersonalDashboardStudent[]) => void;
};

export function StudentRegisterDrawer({ open, onClose, onStudentsRefresh }: Props) {
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCpf, setRegCpf] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<{
    name: string;
    isNew: boolean;
    matchedBy: string | null;
    tempPassword?: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setRegName(""); setRegEmail(""); setRegPhone(""); setRegCpf("");
      setRegError(null); setRegSuccess(null);
    }
  }, [open]);

  async function handleRegister() {
    setRegLoading(true); setRegError(null);
    try {
      const result = await addStudentDirect({
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim() || undefined,
        cpf: regCpf.trim() || undefined,
      });
      setRegSuccess({
        name: result.student.name,
        isNew: result.isNew,
        matchedBy: result.matchedBy,
        tempPassword: result.tempPassword,
      });
      const dash = await fetchPersonalDashboard();
      if (dash) onStudentsRefresh(dash.students);
    } catch (e: unknown) {
      const err = e as Error & { code?: string };
      setRegError(
        err.code === "ALREADY_ASSIGNED"
          ? "Este aluno já está na sua carteira."
          : (err.message || "Não foi possível cadastrar o aluno.")
      );
    } finally {
      setRegLoading(false);
    }
  }

  return (
    <DrawerShell open={open} onClose={onClose} ariaLabel="Cadastrar aluno">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="pp-drawer-title">Cadastrar aluno</div>
        <button type="button" className="pp-btn pp-btn--icon pp-btn--ghost" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {regSuccess ? (
        <>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px solid ${COLORS.successBorder}`,
              background: COLORS.successBg,
              fontSize: 14,
              color: COLORS.text,
              lineHeight: 1.5,
            }}
          >
            {regSuccess.isNew
              ? <><b>{regSuccess.name}</b> foi cadastrado e adicionado à sua carteira.</>
              : (
                <><b>{regSuccess.name}</b> já tinha conta — vinculado à sua carteira
                  {regSuccess.matchedBy
                    ? ` por ${regSuccess.matchedBy === "email" ? "e-mail" : regSuccess.matchedBy === "cpf" ? "CPF" : "telefone"}`
                    : ""}.
                </>
              )
            }
          </div>
          {regSuccess.tempPassword ? (
            <div className="pp-temp-password" role="status">
              <span>Senha temporária</span>
              <strong>{regSuccess.tempPassword}</strong>
              <small>O aluno deverá trocar esta senha no primeiro login.</small>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="pp-btn pp-btn--quiet pp-btn--sm"
              onClick={() => {
                setRegSuccess(null);
                setRegName(""); setRegEmail(""); setRegPhone(""); setRegCpf("");
              }}
            >
              Cadastrar outro
            </button>
            <button type="button" className="pp-btn pp-btn--primary pp-btn--sm" onClick={onClose}>
              Fechar
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
            Preencha os dados do aluno. Se já tiver conta, será vinculado automaticamente.
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
                Nome completo <span style={{ color: COLORS.danger }}>*</span>
              </label>
              <input
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Ex: Maria Souza"
                className="pp-input"
                style={{ width: "100%" }}
                maxLength={255}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
                E-mail <span style={{ color: COLORS.danger }}>*</span>
              </label>
              <input
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="aluno@email.com"
                type="email"
                className="pp-input"
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
                  Telefone (opcional)
                </label>
                <input
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  type="tel"
                  className="pp-input"
                  style={{ width: "100%" }}
                  maxLength={20}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
                  CPF (opcional)
                </label>
                <input
                  value={regCpf}
                  onChange={(e) => setRegCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="pp-input"
                  style={{ width: "100%" }}
                  maxLength={14}
                />
              </div>
            </div>
          </div>

          {regError ? (
            <div
              style={{
                color: COLORS.danger,
                fontSize: 13,
                background: COLORS.dangerBg,
                border: `1px solid ${COLORS.dangerBorder}`,
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              {regError}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="pp-btn pp-btn--quiet pp-btn--sm" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--primary pp-btn--sm"
              disabled={regLoading || !regName.trim() || !regEmail.trim()}
              onClick={() => void handleRegister()}
            >
              {regLoading ? "Cadastrando…" : "Cadastrar"}
            </button>
          </div>
        </>
      )}
    </DrawerShell>
  );
}
