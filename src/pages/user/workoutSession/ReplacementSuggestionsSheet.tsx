import { useEffect, useRef, useState } from "react";
import { useDismissable } from "../../../lib/overlayStack";
import {
  fetchReplacementSuggestions,
  type ReplacementSuggestion,
} from "../../../services/exerciseReplacementSuggestionsApi";
import type { PickedExercise } from "../freeWorkout/FreeExercisePickerSheet";
import { trackReplacementSuggestionEvent } from "./replacementSuggestionEvents";
import "./workoutSession.css";

/**
 * Camada de sugestões inteligentes, entre "tocar em Substituir exercício" e
 * a busca manual de sempre (Sprint P2A, `docs/sprints/P2A_SMART_EXERCISE_SUBSTITUTION.md`).
 *
 * O motor é um ATALHO, nunca uma obrigação: qualquer coisa que não seja uma
 * lista pronta em poucos segundos — erro, vazio, timeout — cai direto no
 * "Buscar outro exercício", que abre o `FreeExercisePickerSheet` de sempre.
 * O fluxo manual continua existindo e funcionando sozinho, como sempre
 * funcionou (P0).
 *
 * `reasonCategory` não é enviado nesta chamada (D10 — ver
 * `exerciseReplacementSuggestionsApi.ts`): o motivo da troca só é perguntado
 * DEPOIS, em `SubstitutionConfirmSheet`, e perguntar de novo aqui seria
 * fricção nova. Consequência aceita: `cautionAdvisory` nunca vem `true` por
 * este caminho nesta sprint — a branch abaixo existe e é testada, mas fica
 * inatingível pelo fluxo real até uma sprint futura decidir capturar o
 * motivo mais cedo.
 */

interface Props {
  open: boolean;
  /** `null` quando o exercício atual não tem id de catálogo (ficha legada) — sem id não há como pedir sugestão. */
  originalExerciseId: string | null;
  originalName: string;
  onClose: () => void;
  /** Sugestão escolhida — segue o MESMO caminho de `handleSwapPick` que a busca manual já usa. */
  onPick: (exercise: PickedExercise) => void;
  /** "Buscar outro exercício" — abre o picker manual existente, sem duplicar sua lógica. */
  onManualSearch: () => void;
  /**
   * Ids já presentes na sessão ao vivo (mesmo conjunto de `selectedIds` do
   * `FreeExercisePickerSheet`). `replaceLiveExercise` recusa em silêncio
   * (`unchanged`) quando o alvo já existe em outra posição — sem este filtro,
   * o motor podia sugerir um exercício que já está na ficha (comum: mesmo
   * grupo muscular), o aluno confirmava a troca e a folha fechava sem
   * NADA acontecer, sem aviso nenhum (achado em QA real, Sprint P2B).
   */
  excludeExerciseIds?: Set<string>;
}

type LoadState = "loading" | "ready" | "empty" | "error";

export function ReplacementSuggestionsSheet({
  open,
  originalExerciseId,
  originalName,
  onClose,
  onPick,
  onManualSearch,
  excludeExerciseIds,
}: Props) {
  const [state, setState] = useState<LoadState>("loading");
  const [suggestions, setSuggestions] = useState<ReplacementSuggestion[]>([]);
  const [cautionAdvisory, setCautionAdvisory] = useState(false);
  /** Marca se ALGUMA sugestão foi escolhida — decide se o fechamento conta como "ignorado". */
  const pickedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    pickedRef.current = false;
    setSuggestions([]);
    setCautionAdvisory(false);

    // Sem id de catálogo não há o que perguntar ao motor — cai direto no
    // fallback, sem registrar erro (não foi uma falha, foi a ausência do
    // pré-requisito).
    if (!originalExerciseId) {
      setState("empty");
      return;
    }

    setState("loading");
    trackReplacementSuggestionEvent("replacement_suggestions_opened");

    let alive = true;
    fetchReplacementSuggestions(originalExerciseId).then((result) => {
      if (!alive) return;
      if (!result) {
        setState("error");
        trackReplacementSuggestionEvent("replacement_suggestions_error");
        return;
      }
      // Filtra sugestões que duplicariam um exercício já presente na sessão —
      // mesma regra que o picker manual já aplica via `selectedIds`, sem a
      // qual a troca era aceita na tela e recusada em silêncio mais adiante.
      const filtered = excludeExerciseIds
        ? result.suggestions.filter((s) => !excludeExerciseIds.has(s.exercise.id))
        : result.suggestions;
      setCautionAdvisory(result.cautionAdvisory);
      setSuggestions(filtered);
      if (filtered.length === 0) {
        setState("empty");
        trackReplacementSuggestionEvent("replacement_suggestions_empty");
      } else {
        setState("ready");
        trackReplacementSuggestionEvent("replacement_suggestion_impression", {
          count: filtered.length,
          cautionAdvisory: result.cautionAdvisory,
        });
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `excludeExerciseIds` é recriado a cada render do pai (novo Set); recarregar por identidade dispararia o fetch de novo sem necessidade. Reavaliado só quando a folha (re)abre ou o exercício original muda, igual antes desta mudança.
  }, [open, originalExerciseId]);

  function handleClose() {
    if (state === "ready" && suggestions.length > 0 && !pickedRef.current) {
      trackReplacementSuggestionEvent("replacement_suggestion_ignored", { count: suggestions.length });
    }
    onClose();
  }

  useDismissable(handleClose, open);

  function handlePick(suggestion: ReplacementSuggestion, position: number) {
    pickedRef.current = true;
    trackReplacementSuggestionEvent("replacement_suggestion_selected", {
      tier: suggestion.tier,
      position,
      usedBeforeBadge: suggestion.usedBeforeBadge,
    });
    onPick({
      id: suggestion.exercise.id,
      name: suggestion.exercise.name,
      bodyPart: suggestion.exercise.bodyPart ?? null,
    });
  }

  function handleManualSearch() {
    trackReplacementSuggestionEvent("replacement_manual_search_selected", {
      hadSuggestions: state === "ready" && suggestions.length > 0,
    });
    onManualSearch();
  }

  if (!open) return null;

  const showList = state === "ready" && suggestions.length > 0;

  return (
    <div
      className="drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ws-rsug-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div className="drawer-panel ws-rsug-sheet">
        <div className="ws-rsug-head">
          <div>
            <h2 id="ws-rsug-title" className="ws-sub-title">
              Substituir {originalName}
            </h2>
            <div className="ws-rsug-sub">
              {state === "loading"
                ? "Buscando alternativas…"
                : cautionAdvisory && showList
                  ? "Outras opções"
                  : "Sugestões para você"}
            </div>
          </div>
          <button type="button" className="ws-rsug-close" onClick={handleClose} aria-label="Fechar sugestões">
            ✕
          </button>
        </div>

        {/* D8: motivo dor/desconforto reduz confiança, nunca some com as
            opções — nenhuma afirmação de segurança, só o aviso fixo da spec. */}
        {cautionAdvisory && showList ? (
          <div className="ws-rsug-caution" role="note">
            Escolha outra opção ou siga a orientação do seu Personal.
          </div>
        ) : null}

        {state === "loading" ? (
          <div className="ws-rsug-status">Buscando alternativas…</div>
        ) : showList ? (
          <div className="ws-rsug-list">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.exercise.id}
                type="button"
                className="ws-rsug-item"
                onClick={() => handlePick(suggestion, index)}
              >
                <span className="ws-rsug-item-head">
                  <span className="ws-rsug-name">{suggestion.exercise.name}</span>
                  {suggestion.label ? <span className="ws-rsug-badge">{suggestion.label}</span> : null}
                </span>
                {/* D6: selo complementar — nunca troca o rótulo acima, só soma. */}
                {suggestion.usedBeforeBadge ? (
                  <span className="ws-rsug-used">Você já usou esta alternativa</span>
                ) : null}
                <span className="ws-rsug-reason">{suggestion.reason}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="ws-rsug-status">Não encontramos uma sugestão pronta agora.</div>
        )}

        <button type="button" className="btn btn-ghost ws-rsug-manual" onClick={handleManualSearch}>
          Buscar outro exercício
        </button>
      </div>
    </div>
  );
}
