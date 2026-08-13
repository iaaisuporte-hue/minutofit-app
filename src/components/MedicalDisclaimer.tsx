/**
 * Aviso de que o conteúdo não é aconselhamento médico.
 *
 * Já existia espalhado em PAR-Q, Lab, treino sugerido e nutrição, com redações
 * diferentes. Telas que interpretam sinais fisiológicos (metabolismo, tracker)
 * estavam sem — e é justamente onde a leitura pode ser confundida com
 * diagnóstico. As lojas cobram isso de apps de saúde e a Política de
 * Privacidade pública já promete o mesmo.
 */
export function MedicalDisclaimer({ children }: { children?: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: "var(--text-xs, 12px)",
        lineHeight: 1.5,
        color: "var(--color-text-muted)",
      }}
    >
      {children ??
        "Estas leituras são um apoio ao seu acompanhamento e não substituem avaliação médica ou diagnóstico clínico."}
    </p>
  );
}
