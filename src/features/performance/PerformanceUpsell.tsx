import { useEffect } from "react";
import { LineChart } from "lucide-react";
import { postPerformanceEvent } from "./performanceEvents";
import { isNativeApp } from "../../lib/platform";

/**
 * Convite ao Premium quando o backend devolve `gated: true` (Spec 033, P2).
 *
 * Não é bloqueio de tela: o servidor já não mandou os dados, e esta é a
 * explicação honesta do porquê. Diz o que existe do outro lado sem prometer
 * número — o aluno descobre o valor real ao ver a própria curva, não uma
 * amostra fabricada aqui.
 *
 * Em app nativo o botão de assinatura some (política de loja): o texto explica
 * onde concluir, sem link de pagamento.
 */
export function PerformanceUpsell({ area }: { area: "progressao" | "recordes" }) {
  useEffect(() => {
    postPerformanceEvent("performance.upgrade_cta_clicked", { area, shown: true });
  }, [area]);

  const copy =
    area === "progressao"
      ? "A curva de cada exercício — carga e 1RM estimado ao longo do tempo — faz parte do plano Premium."
      : "Seus recordes por exercício fazem parte do plano Premium.";

  return (
    <div className="perf-soon">
      <LineChart size={22} aria-hidden="true" style={{ justifySelf: "center", color: "var(--color-accent)" }} />
      <span className="perf-soon-title">Disponível no Premium</span>
      <p className="perf-soon-copy">
        {copy} Seus treinos continuam sendo registrados normalmente — quando você assinar, o
        histórico que já existe aparece inteiro, sem recomeçar do zero.
      </p>
      {!isNativeApp() && (
        <a
          className="btn btn-accent"
          href="/app/user/upgrade"
          style={{ justifySelf: "center", minHeight: 44, display: "inline-flex", alignItems: "center" }}
          onClick={() => postPerformanceEvent("performance.upgrade_cta_clicked", { area, clicked: true })}
        >
          Ver o plano Premium
        </a>
      )}
    </div>
  );
}
