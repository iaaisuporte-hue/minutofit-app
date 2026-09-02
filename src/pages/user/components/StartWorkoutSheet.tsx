import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getWorkoutSessionDetail,
  listWorkoutSessionsPage,
  type WorkoutSessionListItem,
} from "../../../services/workoutSessionApi";
import {
  alvoDePlano,
  podeRepetir,
  prepararLivreRepetido,
} from "../workoutSession/repeatWorkout";

interface Props {
  /** Rota do treino de hoje, quando existe ficha com exercícios. */
  rotaHoje: string | null;
  rotuloHoje: string | null;
  onClose: () => void;
}

/**
 * Folha "Iniciar treino" (SPEC P1 §26 + §24).
 *
 * O card do treino de hoje na Hoje continua sendo o caminho de UM toque; esta
 * folha é o menu das alternativas — treino livre e repetir o último. Corrida,
 * caminhada e bike ficam de fora por decisão da própria SPEC (§26: "Nesta P1
 * não incluir"), não por esquecimento.
 */
export function StartWorkoutSheet({ rotaHoje, rotuloHoje, onClose }: Props) {
  const navigate = useNavigate();
  const [ultima, setUltima] = useState<WorkoutSessionListItem | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);

  useEffect(() => {
    let vivo = true;
    // Só a primeira página: a ação é "repetir O ÚLTIMO", então basta a sessão
    // repetível mais recente.
    listWorkoutSessionsPage(10)
      .then((pagina) => {
        if (!vivo) return;
        setUltima(pagina.sessions.find(podeRepetir) ?? null);
      })
      .catch(() => { /* sem histórico é estado válido, não erro */ })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  async function repetir() {
    if (!ultima || preparando) return;
    setPreparando(true);
    setErro(null);
    try {
      if (ultima.source === "personal") {
        navigate(alvoDePlano(ultima).route);
        return;
      }
      // Livre: a estrutura só existe no que foi executado, então precisa do
      // detalhe da sessão para ser remontada.
      const detalhe = await getWorkoutSessionDetail(ultima.id);
      if (!detalhe) {
        setErro("Não consegui carregar esse treino agora. Tente de novo.");
        return;
      }
      const alvo = prepararLivreRepetido(detalhe);
      if (!alvo) {
        setErro("Esse treino não pode ser repetido — os exercícios não estão mais no catálogo.");
        return;
      }
      navigate(alvo.route);
    } finally {
      setPreparando(false);
    }
  }

  return (
    <div
      className="drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sws-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="drawer-panel sws">
        <div className="sws__head">
          <h2 id="sws-title" className="sws__title">Iniciar treino</h2>
          <button type="button" className="sws__close" onClick={onClose} aria-label="Fechar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {erro ? <div className="sws__erro" role="alert">{erro}</div> : null}

        <div className="sws__opcoes">
          {rotaHoje ? (
            <button type="button" className="sws__opcao sws__opcao--primaria" onClick={() => navigate(rotaHoje)}>
              <span className="sws__op-nome">Treino planejado</span>
              <span className="sws__op-desc">{rotuloHoje ?? "O treino de hoje da sua ficha"}</span>
            </button>
          ) : null}

          <button type="button" className="sws__opcao" onClick={() => navigate("/app/user/treino-livre")}>
            <span className="sws__op-nome">Treino livre</span>
            <span className="sws__op-desc">Monte na hora, escolhendo os exercícios</span>
          </button>

          {/* Repetir o último: some quando não há o que repetir, em vez de
              aparecer desabilitado explicando um vazio. */}
          {!carregando && ultima ? (
            <button type="button" className="sws__opcao" onClick={() => void repetir()} disabled={preparando}>
              <span className="sws__op-nome">
                {preparando ? "Preparando…" : "Repetir último treino"}
              </span>
              <span className="sws__op-desc">{ultima.title?.trim() || "Última sessão registrada"}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
