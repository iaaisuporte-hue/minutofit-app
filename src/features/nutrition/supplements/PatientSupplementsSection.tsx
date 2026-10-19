import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Pill, Plus } from "lucide-react";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import {
  SupplementApiError,
  fetchPatientSupplements,
  updatePatientSupplement,
  type NutriSupplement,
  type SupplementStatus,
} from "../../../services/supplementsApi";
import { SupplementCard } from "./SupplementCard";
import { SupplementEditor } from "./SupplementEditor";
import { formatTakenAt } from "./supplementLabels";

/**
 * Linha de uso para o nutri (decisão do usuário, 19/10/2026): só fatos —
 * último registro e quantos nos últimos 7 dias. Ausência de registro é dita
 * como tal, nunca como "não tomou"; sem percentual nem alerta.
 */
function UsageLine({ usage }: { usage: NutriSupplement["usage"] }) {
  if (!usage.lastUsedAt) return <span className="supplementCard__usage">Nenhuma utilização registrada</span>;
  return (
    <span className="supplementCard__usage">
      Último registro {formatTakenAt(usage.lastUsedAt)} · {usage.count7d} {usage.count7d === 1 ? "registro" : "registros"} em 7 dias
    </span>
  );
}

/**
 * Suplementação do paciente na aba Plano do nutri (Spec 040). Orientações
 * ativas e suspensas sempre visíveis; encerradas recolhidas. Encerrar pede
 * confirmação porque é terminal.
 */
export function PatientSupplementsSection({ patientId }: { patientId: number }) {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [items, setItems] = useState<NutriSupplement[]>([]);
  const [consentRevoked, setConsentRevoked] = useState(false);
  const [editing, setEditing] = useState<NutriSupplement | "new" | null>(null);
  const [confirmEnd, setConfirmEnd] = useState<NutriSupplement | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [endedOpen, setEndedOpen] = useState(false);

  const fetchAll = useCallback(() => {
    return fetchPatientSupplements(patientId)
      .then((list) => {
        setItems(list);
        setState("ready");
      })
      .catch((err) => {
        if (err instanceof SupplementApiError && err.consentRevoked) setConsentRevoked(true);
        setState("error");
      });
  }, [patientId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  async function changeStatus(s: NutriSupplement, next: SupplementStatus, message: string) {
    setBusyId(s.id);
    setStatus("");
    try {
      await updatePatientSupplement(patientId, s.id, { status: next });
      await fetchAll();
      setStatus(message);
    } catch {
      setStatus("Não foi possível atualizar agora. Tente novamente.");
    } finally {
      setBusyId(null);
    }
  }

  if (consentRevoked) return null;

  const current = items.filter((s) => s.status !== "ended");
  const ended = items.filter((s) => s.status === "ended");

  return (
    <section className="card cardPad supplementsSection" aria-label="Suplementação">
      <div className="supplementsSection__header">
        <h2 className="supplementsSection__title"><Pill size={18} aria-hidden="true" /> Suplementação</h2>
        {state === "ready" && (
          <button type="button" className="btn btn-secondary btn-sm" style={{ minHeight: 44 }} onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden="true" /> Adicionar
          </button>
        )}
      </div>

      {state === "loading" && <p className="nutritionGoals__message">Carregando suplementação...</p>}

      {state === "error" && (
        <div role="alert" className="nutritionGoals__message">
          <span>Não foi possível carregar a suplementação.</span>
          <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => { setState("loading"); void fetchAll(); }}>
            Tentar novamente
          </button>
        </div>
      )}

      {state === "ready" && current.length === 0 && (
        <p className="nutritionGoals__message">Nenhuma suplementação orientada para este paciente.</p>
      )}

      {state === "ready" && current.length > 0 && (
        <div className="supplementsSection__list">
          {current.map((s) => (
            <SupplementCard key={s.id} supplement={s} showStatus>
              <UsageLine usage={s.usage} />
              <div className="supplementCard__actions">
                <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} disabled={busyId === s.id} onClick={() => setEditing(s)}>
                  Editar
                </button>
                {s.status === "active" ? (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} disabled={busyId === s.id} onClick={() => void changeStatus(s, "suspended", `${s.name} suspensa.`)}>
                    Suspender
                  </button>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} disabled={busyId === s.id} onClick={() => void changeStatus(s, "active", `${s.name} reativada.`)}>
                    Reativar
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm supplementCard__danger" style={{ minHeight: 44 }} disabled={busyId === s.id} onClick={() => setConfirmEnd(s)}>
                  Encerrar
                </button>
              </div>
            </SupplementCard>
          ))}
        </div>
      )}

      <div role="status" aria-live="polite" className="field-hint">{status}</div>

      {state === "ready" && ended.length > 0 && (
        <div className="supplementsSection__logs">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ minHeight: 44 }}
            aria-expanded={endedOpen}
            aria-controls="supplements-ended"
            onClick={() => setEndedOpen((o) => !o)}
          >
            Encerradas ({ended.length})
            <ChevronDown size={16} aria-hidden="true" style={{ transform: endedOpen ? "rotate(180deg)" : undefined }} />
          </button>
          {endedOpen && (
            <div id="supplements-ended" className="supplementsSection__list">
              {ended.map((s) => (
                <SupplementCard key={s.id} supplement={s} showStatus>
                  <UsageLine usage={s.usage} />
                </SupplementCard>
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <SupplementEditor
          patientId={patientId}
          supplement={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setStatus(`${saved.name} salva.`);
            void fetchAll();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmEnd !== null}
        title="Encerrar esta suplementação?"
        message="O paciente deixa de vê-la e ela não poderá ser reativada. O histórico de uso é mantido."
        confirmLabel="Encerrar"
        danger
        onCancel={() => setConfirmEnd(null)}
        onConfirm={() => {
          const s = confirmEnd;
          setConfirmEnd(null);
          if (s) void changeStatus(s, "ended", `${s.name} encerrada.`);
        }}
      />
    </section>
  );
}
