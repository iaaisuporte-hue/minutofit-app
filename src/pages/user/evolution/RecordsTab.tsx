/**
 * Aba Recordes — estrutura da P1, funcionalidade na P2.
 *
 * A aba existe (a rota e o deep link fazem parte do contrato da P1), mas não
 * simula o que ainda não foi construído: sem números de mentira, sem gráfico de
 * exemplo, sem CTA de upgrade. O texto diz exatamente o estado real — e é
 * verdade que os dados já estão sendo acumulados, porque o backfill e o
 * write-through da P1 já gravam a base dos recordes.
 */
export default function RecordsTab() {
  return (
    <div className="perf-soon">
      <span className="perf-soon-title">Recordes ainda não estão disponíveis</span>
      <p className="perf-soon-copy">
        Seus treinos já estão sendo registrados com carga e repetições — é essa base que vai
        alimentar os recordes quando eles chegarem, inclusive os que você já fez.
      </p>
    </div>
  );
}
