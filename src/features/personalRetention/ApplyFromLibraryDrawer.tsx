import { useEffect, useMemo, useState } from "react";
import { X, Sparkles, BookMarked } from "lucide-react";
import { DrawerShell } from "../../components/overlay/DrawerShell";
import {
  fetchProtocolSuggestions,
  fetchWorkoutProtocolById,
  fetchWorkoutProtocols,
  type ProtocolSuggestion,
  type WorkoutProtocol,
} from "../../services/workoutProtocolsApi";
import { createPersonalWorkoutPlan } from "../../services/personalWorkoutApi";

type Props = {
  studentId: string;
  studentName: string;
  onClose: () => void;
  onApplied: (planTitle: string) => void;
  onError: (message: string) => void;
};

type ListItem = {
  protocolId: number;
  title: string;
  scope: WorkoutProtocol["scope"];
  weekPreset?: string;
  daysCount?: number;
  focus?: string | null;
  suggestionReason?: string;
};

function scopeLabel(scope: WorkoutProtocol["scope"]): string {
  if (scope === "platform") return "CoreFit";
  if (scope === "academy") return "Academia";
  return "Sua biblioteca";
}

export function ApplyFromLibraryDrawer({ studentId, studentName, onClose, onApplied, onError }: Props) {
  const [suggestions, setSuggestions] = useState<ProtocolSuggestion[]>([]);
  const [protocols, setProtocols] = useState<WorkoutProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [sugg, list] = await Promise.all([
          fetchProtocolSuggestions(studentId).catch(() => []),
          fetchWorkoutProtocols({ scope: "personal", limit: 80 }).catch(() => []),
        ]);
        if (cancelled) return;
        setSuggestions(sugg);
        setProtocols(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const suggestedItems: ListItem[] = useMemo(() => {
    return suggestions.map((s) => {
      const full = protocols.find((p) => p.id === s.protocolId);
      return {
        protocolId: s.protocolId,
        title: s.title,
        scope: s.scope,
        weekPreset: full?.weekPreset,
        daysCount: full?.days?.length,
        focus: full?.selectedGroup ?? null,
        suggestionReason: s.reason,
      };
    });
  }, [suggestions, protocols]);

  const restItems: ListItem[] = useMemo(() => {
    const suggestedIds = new Set(suggestions.map((s) => s.protocolId));
    return protocols
      .filter((p) => !suggestedIds.has(p.id))
      .map((p) => ({
        protocolId: p.id,
        title: p.title,
        scope: p.scope,
        weekPreset: p.weekPreset,
        daysCount: p.days?.length ?? 0,
        focus: p.selectedGroup,
      }));
  }, [protocols, suggestions]);

  async function applyProtocol(protocolId: number, title: string) {
    setApplyingId(protocolId);
    try {
      const full = await fetchWorkoutProtocolById(protocolId);
      const days = (full.days?.length ?? 0) > 0
        ? full.days.map((d) => ({ name: d.name, focus: d.focus, items: d.items }))
        : [
            {
              name: full.selectedGroup ?? "Único",
              focus: full.selectedGroup ?? null,
              items: full.items ?? [],
            },
          ];

      await createPersonalWorkoutPlan(studentId, {
        title: full.title,
        weekPreset: full.weekPreset,
        days,
        sourceProtocolId: full.id,
      });

      onApplied(full.title || title);
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Não foi possível aplicar a ficha.");
      setApplyingId(null);
    }
  }

  return (
    <DrawerShell open onClose={onClose} ariaLabel={`Aplicar ficha da biblioteca para ${studentName}`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 className="pp-quick-msg-title">Aplicar ficha da biblioteca</h3>
          <p className="small" style={{ margin: "2px 0 0", color: "var(--color-text-muted)" }}>
            Reaproveite um protocolo pronto para {studentName}.
          </p>
        </div>
        <button onClick={onClose} className="pp-btn pp-btn--icon pp-btn--ghost" aria-label="Fechar">
          <X size={18} />
        </button>
      </div>

      {loading ? (
        <p className="muted" style={{ marginTop: "var(--space-3)" }}>Carregando protocolos…</p>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-4)", marginTop: "var(--space-2)" }}>
          {suggestedItems.length > 0 && (
            <section style={{ display: "grid", gap: "var(--space-2)" }}>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={12} /> Sugestões para {studentName}
              </p>
              {suggestedItems.map((item) => (
                <ProtocolRow
                  key={`s-${item.protocolId}`}
                  item={item}
                  applying={applyingId === item.protocolId}
                  disabled={applyingId !== null}
                  onApply={() => void applyProtocol(item.protocolId, item.title)}
                />
              ))}
            </section>
          )}

          {restItems.length > 0 && (
            <section style={{ display: "grid", gap: "var(--space-2)" }}>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <BookMarked size={12} /> {suggestedItems.length > 0 ? "Outros protocolos seus" : "Sua biblioteca"}
              </p>
              {restItems.map((item) => (
                <ProtocolRow
                  key={`r-${item.protocolId}`}
                  item={item}
                  applying={applyingId === item.protocolId}
                  disabled={applyingId !== null}
                  onApply={() => void applyProtocol(item.protocolId, item.title)}
                />
              ))}
            </section>
          )}

          {suggestedItems.length === 0 && restItems.length === 0 && (
            <p className="muted">Você ainda não tem protocolos salvos na biblioteca. Crie um pelo builder e ele aparecerá aqui.</p>
          )}
        </div>
      )}
    </DrawerShell>
  );
}

function ProtocolRow({
  item,
  applying,
  disabled,
  onApply,
}: {
  item: ListItem;
  applying: boolean;
  disabled: boolean;
  onApply: () => void;
}) {
  return (
    <div
      className="card card-pad"
      style={{
        display: "grid",
        gap: 8,
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
      }}
    >
      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</strong>
          <span className="pp-badge pp-badge--soft" style={{ fontSize: "var(--text-xs)" }}>{scopeLabel(item.scope)}</span>
        </div>
        <div className="small" style={{ color: "var(--color-text-muted)" }}>
          {item.weekPreset ? `Frequência ${item.weekPreset}` : "Frequência —"}
          {item.daysCount != null ? ` · ${item.daysCount} dia(s)` : ""}
          {item.focus ? ` · Foco ${item.focus}` : ""}
        </div>
        {item.suggestionReason ? (
          <div className="small" style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
            {item.suggestionReason}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="pp-btn pp-btn--primary pp-btn--sm"
        disabled={disabled}
        onClick={onApply}
      >
        {applying ? "Aplicando…" : "Aplicar"}
      </button>
    </div>
  );
}
