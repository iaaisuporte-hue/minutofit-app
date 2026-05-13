import { EmptyState } from "../../components/EmptyState";
import "./personalPremium.css";

/**
 * Programas (MaaS) — placeholder honesto até catálogo institucional no backend.
 * Rotas antigas e deep links continuam válidos em `/app/personal/library`.
 */
export default function WorkoutLibraryPage() {
  return (
    <div className="pp-page">
      <section className="pp-panel">
        <div className="pp-panel__header">
          <div style={{ display: "grid", gap: 5 }}>
            <div className="pp-panel__title">Programas alinhados ao metabolismo</div>
            <div className="pp-panel__subtitle">
              Em breve: modelos de periodização e descarga conectados aos sinais da carteira (sono, carga, score
              metabólico) — sem catálogo mock.
            </div>
          </div>
        </div>
        <div className="pp-panel__body">
          <EmptyState
            variant="info"
            eyebrow="Roadmap"
            title="Programas MaaS em construção"
            description="O MetaCore vai sugerir programas por faixa metabólica e recuperação, não apenas fichas genéricas. Enquanto isso, use o builder por aluno para prescrever com contexto vivo no perfil."
          />
        </div>
      </section>
    </div>
  );
}
