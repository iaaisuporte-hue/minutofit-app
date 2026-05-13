import { useState } from "react";
import {
  registerReceptionCheckin,
  registerReceptionDenied,
  registerReceptionException,
  registerReceptionVisitor,
  type ReceptionStudent,
} from "../../../services/academyApi";
import { ExceptionReasonDialog } from "./ExceptionReasonDialog";
import { QuickStudentSearch } from "./QuickStudentSearch";
import { StudentAccessCard } from "./StudentAccessCard";

type DialogMode = "exception" | "deny" | "visitor" | null;

export default function RecepcaoCheckinPage() {
  const [selected, setSelected] = useState<ReceptionStudent | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<DialogMode>(null);

  const [visitorName, setVisitorName] = useState("");
  const [visitorDocument, setVisitorDocument] = useState("");
  const [visitorType, setVisitorType] = useState<"visitor" | "external_personal">("visitor");

  async function run(action: () => Promise<unknown>, success: string) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
      setSelected(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function resetVisitor() {
    setVisitorName("");
    setVisitorDocument("");
    setVisitorType("visitor");
    setDialog(null);
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="dash-eyebrow">Recepção</div>
          <h1 className="page-title">Check-in manual</h1>
          <p className="dash-hero-meta">
            Busca instantânea, liberação rápida e exceções com auditoria.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => setDialog("visitor")}>
          Visitante / personal externo
        </button>
      </div>

      {message && <div className="banner-success">{message}</div>}
      {error && <div className="banner-error">{error}</div>}

      <div className="section-card" style={{ display: "grid", gap: "var(--space-4)" }}>
        <QuickStudentSearch autoFocus onSelect={setSelected} />
      </div>

      {selected && (
        <StudentAccessCard
          student={selected}
          loading={loading}
          onClear={() => setSelected(null)}
          onCheckin={() => run(
            () => registerReceptionCheckin(selected.userId),
            "Entrada liberada e registrada com sucesso."
          )}
          onException={() => setDialog("exception")}
          onDeny={() => setDialog("deny")}
        />
      )}

      {dialog === "exception" && selected && (
        <ExceptionReasonDialog
          title="Liberar com exceção"
          description="Use quando houver pendência, status em revisão ou autorização pontual do gestor."
          confirmLabel="Liberar com exceção"
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => {
            setDialog(null);
            run(
              () => registerReceptionException(selected.userId, reason),
              "Exceção registrada e entrada liberada."
            );
          }}
        />
      )}

      {dialog === "deny" && selected && (
        <ExceptionReasonDialog
          title="Registrar bloqueio"
          description="Registra que a entrada foi negada e salva o motivo na auditoria."
          confirmLabel="Registrar bloqueio"
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => {
            setDialog(null);
            run(
              () => registerReceptionDenied(selected.userId, reason),
              "Bloqueio registrado para auditoria."
            );
          }}
        />
      )}

      {dialog === "visitor" && (
        <div className="drawer-overlay" onClick={(event) => { if (event.target === event.currentTarget) resetVisitor(); }}>
          <div className="drawer-panel" style={{ maxWidth: 520 }}>
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                const reason = visitorType === "external_personal" ? "Personal externo autorizado" : "Visitante liberado";
                run(
                  () => registerReceptionVisitor({
                    name: visitorName,
                    document: visitorDocument || undefined,
                    visitorType,
                    reason,
                  }),
                  "Visitante registrado e entrada liberada."
                );
                resetVisitor();
              }}
            >
              <div>
                <div className="dash-eyebrow">Acesso temporário</div>
                <h2 style={{ margin: "4px 0 0", fontSize: "var(--text-lg)" }}>Visitante / personal externo</h2>
              </div>
              <div className="field">
                <label className="label">Nome</label>
                <input className="input" required value={visitorName} onChange={(event) => setVisitorName(event.target.value)} />
              </div>
              <div className="field">
                <label className="label">Documento</label>
                <input className="input" value={visitorDocument} onChange={(event) => setVisitorDocument(event.target.value)} />
              </div>
              <div className="field">
                <label className="label">Tipo</label>
                <select
                  className="input"
                  value={visitorType}
                  onChange={(event) => setVisitorType(event.target.value as "visitor" | "external_personal")}
                >
                  <option value="visitor">Visitante</option>
                  <option value="external_personal">Personal externo</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <button className="btn btn-primary" type="submit" disabled={loading}>Liberar acesso</button>
                <button className="btn btn-ghost" type="button" onClick={resetVisitor}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
