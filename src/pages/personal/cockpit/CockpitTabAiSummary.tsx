import { useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import {
  fetchStudentAiSummary,
  type StudentAiSummaryResult,
} from "../../../services/personalDashboardApi";
import { AiUpgradeCTA } from "../../../features/personalPlan/AiUpgradeCTA";

type Props = {
  studentId: string;
};

export function CockpitTabAiSummary({ studentId }: Props) {
  const [result, setResult] = useState<StudentAiSummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStudentAiSummary(studentId);
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Não foi possível gerar o resumo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16, padding: "4px 0" }}>
      <AiUpgradeCTA />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
            Resumo IA
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
            Síntese contextual da evolução do aluno — gerada sob demanda.
          </div>
        </div>
        <button
          type="button"
          className="pp-btn pp-btn--ghost pp-btn--sm"
          onClick={generate}
          disabled={loading}
          style={{ flexShrink: 0 }}
        >
          {loading ? (
            <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <Sparkles size={13} />
          )}
          {loading ? "Gerando..." : result ? "Atualizar" : "Gerar resumo"}
        </button>
      </div>

      {!result && !loading && !error ? (
        <div
          style={{
            padding: "24px 16px",
            border: "1px dashed var(--color-border)",
            borderRadius: 10,
            textAlign: "center",
            color: "var(--color-text-secondary)",
            fontSize: 13,
          }}
        >
          Clique em "Gerar resumo" para obter uma síntese contextual deste aluno.
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            padding: "12px 14px",
            border: "1px solid var(--color-danger-border, #fca5a5)",
            borderRadius: 10,
            background: "var(--color-danger-soft, #fef2f2)",
            color: "var(--color-danger-text, #dc2626)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {result ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              padding: "14px 16px",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              background: "var(--color-surface-raised)",
              fontSize: 13.5,
              lineHeight: 1.65,
              color: "var(--color-text-primary)",
              whiteSpace: "pre-wrap",
            }}
          >
            {result.summary}
          </div>
          <p
            style={{
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              margin: 0,
              lineHeight: 1.5,
              fontStyle: "italic",
            }}
          >
            {result.disclaimer}
          </p>
        </div>
      ) : null}
    </div>
  );
}
