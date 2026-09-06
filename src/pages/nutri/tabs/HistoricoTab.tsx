import { COLORS } from "../../../styles/colors";
import { EvolucaoTab } from "./EvolucaoTab";
import { ObservationsTab } from "./ObservationsTab";
import { VozTab } from "./VozTab";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: COLORS.text, marginBottom: "var(--space-3)" }}>
      {children}
    </div>
  );
}

/**
 * SPEC 037 / P2.5: composição de Evolução + Observações + Voz — o registro
 * histórico do paciente. Mesma lógica de composição de `AcompanhamentoTab`:
 * nenhum componente reescrito, só empilhado.
 */
export function HistoricoTab({ patientId }: { patientId: number }) {
  return (
    <div className="stack" style={{ gap: "var(--space-7)" }}>
      <section>
        <SectionHeading>Evolução</SectionHeading>
        <EvolucaoTab patientId={patientId} />
      </section>

      <section>
        <SectionHeading>Observações</SectionHeading>
        <ObservationsTab patientId={patientId} />
      </section>

      <section>
        <SectionHeading>Voz</SectionHeading>
        <VozTab patientId={patientId} />
      </section>
    </div>
  );
}
