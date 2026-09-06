import { COLORS } from "../../../styles/colors";
import ClinicalProfileTab from "../ClinicalProfileTab";
import { AdherenceTab } from "./AdherenceTab";
import { ContextTab } from "./ContextTab";
import { InsightsTab } from "./InsightsTab";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: COLORS.text, marginBottom: "var(--space-3)" }}>
      {children}
    </div>
  );
}

/**
 * SPEC 037 / P2.5: composição das 4 abas antigas (Adesão, Contexto, Insights,
 * Perfil clínico completo) que virou UMA aba — "acompanhamento". Nenhum
 * componente foi reescrito: cada seção abaixo é exatamente o mesmo
 * `*Tab.tsx` de antes, só empilhado em vez de escondido detrás de uma aba
 * própria. Zero mudança de regra de negócio.
 */
export function AcompanhamentoTab({ patientId }: { patientId: number }) {
  return (
    <div className="stack" style={{ gap: "var(--space-7)" }}>
      <section>
        <SectionHeading>Adesão</SectionHeading>
        <AdherenceTab patientId={patientId} />
      </section>

      <section>
        <SectionHeading>Insights</SectionHeading>
        <InsightsTab patientId={patientId} />
      </section>

      <section>
        <SectionHeading>Contexto</SectionHeading>
        <ContextTab patientId={patientId} />
      </section>

      <section>
        <SectionHeading>Perfil clínico</SectionHeading>
        <ClinicalProfileTab patientId={patientId} />
      </section>
    </div>
  );
}
