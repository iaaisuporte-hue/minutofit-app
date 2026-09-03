import { useEffect, useState } from "react";
import { useDismissable } from "../../../lib/overlayStack";
import { searchExercises, type ExerciseSummary } from "../../../services/exercisesApi";
import { COLORS } from "../../../styles/colors";

/**
 * Normaliza a descrição livre do exercício (ex: "5 min de mobilidade global",
 * "Flexão tradicional: 4 séries de 10 a 15") no núcleo do movimento, para casar
 * com a biblioteca de exercícios (que carrega os GIFs do free-exercise-db).
 */
function cleanExerciseQuery(activity: string): string {
  let q = activity.trim();
  // corta "N min/séries/x de", "4 séries de 10 a 15 repetições", etc.
  q = q.replace(
    /^\s*\d+\s*(a\s*\d+)?\s*(min(utos)?|s[ée]ries?|x|reps?|repeti[çc][õo]es)\b\.?\s*(de\s+)?/i,
    ""
  );
  // remove sufixo após ":" ou "—" (instruções de série/rep)
  q = q.split(/[:—–]/)[0];
  const words = q.split(/[\s,]+/).filter(Boolean).slice(0, 3);
  return words.join(" ") || activity;
}

function normalizeKey(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Sinônimos PT → termo presente na biblioteca (curado). A biblioteca é PT-BR e já
 * traz GIF para ~todos os movimentos; o gargalo é o nome divergir do gerado pelo
 * motor. Aqui mapeamos os casos onde o nome do exercício não bate por substring.
 */
/**
 * OVERRIDE: o termo literal casa com o exercício ERRADO na biblioteca, então o
 * sinônimo curado é tentado ANTES do literal (vence). Ex.: "elevação de quadril"
 * (ponte de glúteo) casaria por substring com "Prancha com Elevação de Quadril".
 */
const OVERRIDE_ALIASES: Record<string, string> = {
  "elevacao de quadril": "ponte de gluteo",
  "elevacao de pelve": "ponte de gluteo",
  alongamento: "alongamento de peitoral",
  "alongamento rapido": "alongamento de peitoral",
};

/**
 * FALLBACK: tentado DEPOIS do literal — rede de segurança quando o nome do motor
 * não casa por substring, sem sobrescrever um literal que já acerta (ex.: "remada
 * sentada" acha "Remada Sentada no Cabo" sozinho; "puxada alta" precisa do fallback).
 */
const MOVEMENT_ALIASES: Record<string, string> = {
  avanco: "afundo",
  "avanco reverso": "afundo",
  "avanco frontal": "afundo",
  "joelho alto": "corrida no lugar",
  "joelho alto rapido": "corrida no lugar",
  "marcha no lugar": "corrida no lugar",
  marcha: "corrida no lugar",
  "corrida estacionaria": "corrida no lugar",
  "puxada alta": "puxada",
  "remada sentada": "remada",
  mobilidade: "mobilidade de quadril",
  "mobilidade dinamica": "mobilidade de quadril",
  "ativacao de costas": "remada com elastico",
  ativacao: "remada com elastico",
  core: "prancha",
  "core rapido": "prancha",
};

/**
 * Gera candidatos de busca do mais específico ao mais amplo, aplicando sinônimos.
 * Como o backend casa por SUBSTRING do termo inteiro, o nome-núcleo (1ª palavra)
 * costuma ser o que realmente encontra ("flexao" casa "Flexão de Braço").
 */
function buildSearchCandidates(name: string): string[] {
  const cleaned = cleanExerciseQuery(name);
  const words = cleaned.split(/\s+/).filter(Boolean);
  const terms = [cleaned, words.slice(0, 2).join(" "), words[0]].filter(Boolean);
  const out: string[] = [];
  // 1. Overrides primeiro — vencem o literal nos casos de match errado.
  for (const term of terms) {
    const override = OVERRIDE_ALIASES[normalizeKey(term)];
    if (override) out.push(override);
  }
  // 2. Literais (do específico ao núcleo) + fallback como rede de segurança.
  for (const term of terms) {
    out.push(term);
    const alias = MOVEMENT_ALIASES[normalizeKey(term)];
    if (alias) out.push(alias);
  }
  return [...new Set(out.map((t) => t.trim()).filter(Boolean))];
}

/** GIF do free-exercise-db vem como frames /0.jpg e /1.jpg — anima alternando. */
function frame1FromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes("/0.jpg")) return url.replace("/0.jpg", "/1.jpg");
  return null;
}

function useThumbTick() {
  const [tick, setTick] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setTick((v) => !v), 700);
    return () => clearInterval(id);
  }, []);
  return tick;
}

/**
 * Modal de demonstração de exercício por NOME (texto livre vindo do treino
 * sugerido). Busca na biblioteca e exibe o GIF (mesma fonte usada quando a ficha
 * vem do professor). Sem match → mensagem honesta, nunca clique morto.
 */
export function ExerciseDemoModal({ name, onClose }: { name: string; onClose: () => void }) {
  // Escape + botão voltar do Android (auditoria do fechamento).
  useDismissable(onClose);
  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<ExerciseSummary | null>(null);
  const showFrame1 = useThumbTick();

  // O componente é remontado por exercício (key={name} no render), então o estado
  // inicial (loading=true) já cobre o reset — o efeito só dispara a busca.
  useEffect(() => {
    let alive = true;

    // Busca progressiva: tenta os candidatos do mais específico ao mais amplo e
    // para no primeiro com mídia. Guarda o 1º match sem mídia como último recurso
    // (mostra ao menos o nome canônico da biblioteca).
    async function resolve() {
      const candidates = buildSearchCandidates(name);
      let firstNamed: ExerciseSummary | null = null;
      for (const q of candidates) {
        if (!alive) return null;
        try {
          const rows = await searchExercises({ q, limit: 1 });
          const row = rows[0];
          if (row?.primaryMediaUrl) return row;
          if (row && !firstNamed) firstNamed = row;
        } catch {
          /* tenta o próximo candidato */
        }
      }
      return firstNamed;
    }

    resolve()
      .then((row) => {
        if (alive) setExercise(row ?? null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [name]);

  const gifUrl =
    exercise?.primaryMediaUrl &&
    (exercise.primaryMediaType === "gif" || exercise.primaryMediaType === "image")
      ? exercise.primaryMediaUrl
      : null;
  const frame1 = frame1FromUrl(gifUrl);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.panel,
          borderRadius: 18,
          padding: 18,
          maxWidth: 420,
          width: "100%",
          display: "grid",
          gap: 12,
          boxShadow: "0 24px 60px rgba(0,0,0,.28)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.text, lineHeight: 1.3 }}>
            {exercise?.name ?? name}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: 999,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panelSoft,
              cursor: "pointer",
              color: COLORS.muted,
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            maxHeight: 300,
            borderRadius: 12,
            overflow: "hidden",
            background: COLORS.panelSoft,
            display: "grid",
            placeItems: "center",
          }}
        >
          {loading ? (
            <div style={{ color: COLORS.muted, fontSize: 13 }}>Carregando demonstração…</div>
          ) : gifUrl ? (
            <>
              <img
                key={gifUrl}
                src={gifUrl}
                alt={exercise?.name ?? name}
                decoding="async"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  transition: frame1 ? "opacity 0.3s ease" : undefined,
                  opacity: frame1 ? (showFrame1 ? 0 : 1) : 1,
                }}
              />
              {frame1 ? (
                <img
                  src={frame1}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    transition: "opacity 0.3s ease",
                    opacity: showFrame1 ? 1 : 0,
                  }}
                />
              ) : null}
            </>
          ) : (
            <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: 16, lineHeight: 1.5 }}>
              Ainda não temos demonstração para este exercício.
              <br />
              Siga o nome do movimento e mantenha a execução controlada.
            </div>
          )}
        </div>

        {exercise && (exercise.targetMuscle || exercise.equipment) ? (
          <div style={{ fontSize: 12, color: COLORS.muted }}>
            {exercise.targetMuscle}
            {exercise.equipment ? ` · ${exercise.equipment}` : ""}
          </div>
        ) : null}
      </div>
    </div>
  );
}
