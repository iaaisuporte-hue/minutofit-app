import { useEffect, useId, useState } from "react";
import { Bell } from "lucide-react";
import { COLORS } from "../../../styles/colors";
import {
  agendarLembretesTreino,
  cancelarLembretesTreino,
  definirLembretesAtivados,
  lembretesAtivados,
} from "../workoutSession/pendingWorkoutReminder";
import { notificacaoPermitida } from "../workoutSession/notificationPermission";
import { findInProgressSession } from "../workoutSession/inProgressSession";

/**
 * Preferência "Lembrar treino não finalizado".
 *
 * Mesmo controle segmentado da linha "Aparência", pela mesma razão: é uma
 * escolha binária e estável, com o estado atual visível — não um item de lista
 * que esconde o valor até ser tocado.
 *
 * Só existe no app empacotado, e é honestidade e não gate: o lembrete é
 * entregue pelo sistema operacional DESTE aparelho. Na web, com a aba fechada,
 * não há quem o entregue — e um interruptor que não liga nada é pior que
 * interruptor nenhum. Pela mesma razão a preferência é local ao aparelho, como
 * o tema, em vez de uma coluna no servidor.
 *
 * O título é "Lembretes de treino", e não "Notificações", porque é isso que ele
 * governa: o aviso de fim de descanso é outra notificação local e NÃO é
 * desligada aqui. Um rótulo mais amplo que o controle levaria quem se incomoda
 * com o descanso a desligar isto e continuar recebendo aquilo.
 */
export function WorkoutReminderSetting() {
  const [ativo, setAtivo] = useState(lembretesAtivados);
  /** `null` enquanto a consulta ao sistema não voltou — não afirma nada antes. */
  const [permitido, setPermitido] = useState<boolean | null>(null);
  const idRotulo = useId();
  const idDica = useId();

  // Só CONSULTA (nunca pede): com a permissão negada no aparelho, este controle
  // marcado "Ativado" não entregaria nada e não diria por quê.
  useEffect(() => {
    let vivo = true;
    void notificacaoPermitida().then((ok) => {
      if (vivo) setPermitido(ok);
    });
    return () => {
      vivo = false;
    };
  }, []);

  function escolher(valor: boolean) {
    if (valor === ativo) return;
    setAtivo(valor);
    definirLembretesAtivados(valor);

    if (!valor) {
      // Desligar precisa valer AGORA: pode haver lembrete já entregue ao sistema
      // por um treino aberto, e ele tocaria mesmo com a preferência desligada.
      void cancelarLembretesTreino();
      return;
    }
    // E religar precisa valer agora pelo mesmo motivo, ao contrário: sem isto,
    // quem desliga, religa e larga o celular ficava sem lembrete até a próxima
    // série — que é exatamente a pessoa que a feature existe para alcançar.
    const aberta = findInProgressSession();
    if (aberta) {
      void agendarLembretesTreino(
        { mode: aberta.mode, planId: aberta.planId, dayIndex: aberta.dayIndex },
        aberta.lastActivityAt,
      );
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Bell size={18} />
        <div
          style={{
            fontSize: "var(--text-base)",
            fontWeight: "var(--font-bold)",
            color: COLORS.text,
          }}
        >
          Lembretes de treino
        </div>
      </div>

      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        <div id={idRotulo} style={{ fontSize: "var(--text-sm)", color: COLORS.text }}>
          Lembrar treino não finalizado
        </div>
        <div
          id={idDica}
          style={{ fontSize: "var(--text-xs)", color: COLORS.muted, lineHeight: 1.5 }}
        >
          Se um treino ficar aberto, avisamos até duas vezes para você voltar e salvá-lo.
        </div>
      </div>

      <div
        role="group"
        // Amarra o rótulo visível e a explicação ao controle, em vez de repetir
        // o rótulo num aria-label e deixar a explicação órfã do leitor de tela.
        aria-labelledby={idRotulo}
        aria-describedby={idDica}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          padding: 4,
          borderRadius: 14,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.panelDeep,
        }}
      >
        {([["Ativado", true], ["Desativado", false]] as const).map(([rotulo, valor]) => {
          const selecionado = ativo === valor;
          return (
            <button
              key={rotulo}
              type="button"
              aria-pressed={selecionado}
              onClick={() => escolher(valor)}
              style={{
                minHeight: 44,
                borderRadius: 11,
                cursor: "pointer",
                border: selecionado ? `1px solid ${COLORS.border}` : "1px solid transparent",
                background: selecionado ? "var(--color-surface)" : "transparent",
                color: selecionado ? COLORS.text : COLORS.muted,
                fontSize: "var(--text-sm)",
                fontWeight: "var(--font-semibold)",
                touchAction: "manipulation",
              }}
            >
              {rotulo}
            </button>
          );
        })}
      </div>

      {/* A preferência pode estar ligada e o sistema, bloqueado. Dizer isso é o
          que separa "não recebo e não sei por quê" de um caminho de solução. */}
      {ativo && permitido === false && (
        <div className="alert alert-warn" role="status">
          Ative as notificações do S2CORE nos ajustes do aparelho para receber o lembrete.
        </div>
      )}
    </div>
  );
}
