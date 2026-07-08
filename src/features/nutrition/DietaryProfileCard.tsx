import { useEffect, useMemo, useState } from "react";
import { COLORS } from "../../styles/colors";
import {
  fetchMyDietaryProfile,
  DIETARY_KIND_LABELS,
  SEVERITY_LABELS,
  type DietaryKind,
  type ProfileItem,
} from "../../services/nutriApi";

// Ordem de exibição compacta para o aluno (categorias clínicas e medicamentos
// ficam só no detalhe expandido, sem chamar atenção na home).
const SUMMARY_ORDER: DietaryKind[] = ["allergy", "intolerance", "restriction", "preference"];
const DETAIL_ORDER: DietaryKind[] = [
  "allergy",
  "intolerance",
  "restriction",
  "preference",
  "clinical_condition",
  "medication",
];

function severityColor(sev: ProfileItem["severity"]): string {
  if (sev === "severe") return "var(--color-danger)";
  if (sev === "moderate") return "var(--color-warn-text)";
  return COLORS.muted;
}

/**
 * Card compacto "Perfil Alimentar" para a área do aluno. Read-only — quem edita
 * é o nutricionista. Alergia grave aparece em destaque. Não renderiza nada se o
 * perfil estiver vazio (não poluir a home).
 */
export default function DietaryProfileCard() {
  const [items, setItems] = useState<ProfileItem[]>([]);
  const [hasSevereAllergy, setHasSevereAllergy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMyDietaryProfile()
      .then((d) => {
        if (!alive) return;
        setItems(d.items);
        setHasSevereAllergy(d.hasSevereAllergy);
      })
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const byKind = useMemo(() => {
    const map = new Map<DietaryKind, ProfileItem[]>();
    for (const it of items) {
      if (!map.has(it.kind)) map.set(it.kind, []);
      map.get(it.kind)!.push(it);
    }
    return map;
  }, [items]);

  const summary = useMemo(() => {
    const parts: string[] = [];
    for (const k of SUMMARY_ORDER) {
      const n = byKind.get(k)?.length ?? 0;
      if (n > 0) parts.push(`${n} ${DIETARY_KIND_LABELS[k].toLowerCase()}`);
    }
    return parts.join(" · ");
  }, [byKind]);

  if (!loaded || items.length === 0) return null;

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-surface)",
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "12px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {hasSevereAllergy && (
            <span
              aria-hidden
              style={{ width: 8, height: 8, borderRadius: 99, background: "var(--color-danger)", flexShrink: 0 }}
            />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Perfil Alimentar</div>
            <div style={{ fontSize: 12, color: COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {hasSevereAllergy ? "Alergia grave · " : ""}
              {summary || "Ver detalhes"}
            </div>
          </div>
        </div>
        <span style={{ color: COLORS.muted, fontSize: 16, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
          ›
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          {DETAIL_ORDER.map((kind) => {
            const list = byKind.get(kind);
            if (!list || list.length === 0) return null;
            return (
              <div key={kind}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                  {DIETARY_KIND_LABELS[kind]}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {list.map((item) => (
                    <span
                      key={item.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: item.severity === "severe" ? "var(--color-danger)" : COLORS.text,
                        background:
                          item.severity === "severe"
                            ? "var(--color-danger-soft, rgba(220,38,38,.08))"
                            : "var(--color-surface-muted, var(--color-surface-subtle))",
                        border: `1px solid ${item.severity === "severe" ? "var(--color-danger)" : "var(--color-border)"}`,
                        borderRadius: 999,
                        padding: "3px 9px",
                      }}
                    >
                      {item.label}
                      {item.severity && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", color: severityColor(item.severity) }}>
                          {SEVERITY_LABELS[item.severity]}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.4 }}>
            Mantido pelo seu nutricionista. Atualize com ele se algo mudar.
          </div>
        </div>
      )}
    </div>
  );
}
