import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Pill } from "lucide-react";
import {
  getMySupplements,
  logMySupplementUsage,
  undoMySupplementUsage,
  type StudentSupplement,
  type SupplementUsageLog,
} from "../../../services/supplementsApi";
import { SupplementCard } from "./SupplementCard";
import { formatTakenAt } from "./supplementLabels";

function newClientKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Dia do aluno (BRT) — o mesmo `dateKey` que o backend grava. */
function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/**
 * "Minha suplementação" (Spec 040). O aluno vê as orientações ATIVAS do
 * nutri e registra que usou — sem alterar a orientação e sem tocar o diário
 * (o uso não tem nutrientes). Some por inteiro quando não há nada a mostrar:
 * um card vazio permanente seria ruído para quem não usa suplemento.
 */
export function StudentSupplementsSection() {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [supplements, setSupplements] = useState<StudentSupplement[]>([]);
  const [logs, setLogs] = useState<SupplementUsageLog[]>([]);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [logsOpen, setLogsOpen] = useState(false);

  const fetchAll = useCallback(() => {
    return getMySupplements()
      .then((d) => {
        setSupplements(d.supplements);
        setLogs(d.recentLogs);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  async function register(s: StudentSupplement) {
    if (pendingId !== null) return;
    setPendingId(s.id);
    setStatus("");
    try {
      // Uma chave por toque: retry de rede reenvia a mesma e o backend
      // devolve o mesmo registro, nunca dois.
      await logMySupplementUsage(s.id, newClientKey());
      await fetchAll();
      setStatus(`Uso de ${s.name} registrado.`);
    } catch {
      setStatus("Não foi possível registrar agora. Tente novamente.");
    } finally {
      setPendingId(null);
    }
  }

  async function undo(log: SupplementUsageLog) {
    setStatus("");
    try {
      await undoMySupplementUsage(log.id);
      await fetchAll();
      setStatus(`Registro de ${log.supplementName} desfeito.`);
    } catch {
      setStatus("Não foi possível desfazer agora.");
    }
  }

  if (state === "loading") return null;
  if (state === "error") {
    return (
      <section className="card cardPad supplementsSection" aria-label="Minha suplementação">
        <h2 className="supplementsSection__title"><Pill size={18} aria-hidden="true" /> Minha suplementação</h2>
        <div role="alert" className="nutritionGoals__message">
          <span>Não foi possível carregar sua suplementação.</span>
          <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => { setState("loading"); void fetchAll(); }}>
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }
  if (supplements.length === 0 && logs.length === 0) return null;

  const today = todayKey();

  return (
    <section className="card cardPad supplementsSection" aria-label="Minha suplementação">
      <h2 className="supplementsSection__title"><Pill size={18} aria-hidden="true" /> Minha suplementação</h2>
      <p className="supplementsSection__hint">Orientações do seu nutricionista. Registrar o uso não soma calorias ao seu dia.</p>

      {supplements.length === 0 ? (
        <p className="nutritionGoals__message">Nenhuma suplementação ativa no momento.</p>
      ) : (
        <div className="supplementsSection__list">
          {supplements.map((s) => (
            <SupplementCard key={s.id} supplement={s}>
              {s.usedTodayCount > 0 ? (
                <span className="supplementCard__usage supplementCard__usage--done">
                  <Check size={14} aria-hidden="true" />
                  Usado hoje{s.usedTodayCount > 1 ? ` (${s.usedTodayCount}x)` : ""}
                </span>
              ) : (
                <span className="supplementCard__usage">Ainda não registrado hoje</span>
              )}
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ minHeight: 44 }}
                disabled={pendingId !== null}
                onClick={() => void register(s)}
              >
                {pendingId === s.id ? "Registrando..." : "Registrar uso"}
              </button>
            </SupplementCard>
          ))}
        </div>
      )}

      <div role="status" aria-live="polite" className="field-hint">{status}</div>

      {logs.length > 0 && (
        <div className="supplementsSection__logs">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ minHeight: 44 }}
            aria-expanded={logsOpen}
            aria-controls="supplement-recent-logs"
            onClick={() => setLogsOpen((o) => !o)}
          >
            Registros recentes ({logs.length})
            <ChevronDown size={16} aria-hidden="true" style={{ transform: logsOpen ? "rotate(180deg)" : undefined }} />
          </button>
          {logsOpen && (
            <ul id="supplement-recent-logs" className="supplementsSection__logList">
              {logs.map((l) => (
                <li key={l.id}>
                  <span>
                    <strong>{l.supplementName}</strong> · {formatTakenAt(l.takenAt)}
                    {l.note && <span className="muted"> · {l.note}</span>}
                  </span>
                  {l.dateKey === today && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ minHeight: 44 }} onClick={() => void undo(l)}>
                      Desfazer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
