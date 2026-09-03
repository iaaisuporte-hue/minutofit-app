/**
 * Criar/editar exercício da Biblioteca Personalizada do Personal
 * (Sprint P1_PERSONAL_CUSTOM_EXERCISES).
 *
 * DECISÃO (harness item 7 — "página vs sheet"): modal próprio, não rota.
 * "Meus Exercícios" já vive como aba dentro de Programas (`?tab=exercicios`)
 * — criar uma rota separada duplicaria navegação para um fluxo que começa e
 * termina na mesma tela. Estrutura copiada de `ExerciseDetailModal.tsx`
 * (overlay fixo, header/footer fora da área de scroll) em vez de
 * `DrawerShell`: o drawer do personal rola header+corpo+rodapé juntos
 * (`.pp-drawer { overflow-y: auto }`), e a §46 exige rodapé SEMPRE visível
 * mesmo com o teclado aberto — só dá pra garantir isso com o rodapé FORA do
 * contêiner que rola.
 *
 * DECISÃO (campos): sem "músculo alvo" separado — não está na lista do
 * harness, e o backend aceita omitido sem apagar o valor existente (chave
 * ausente no PATCH = campo intocado). Instruções e dicas viram UM textarea
 * cada (uma linha = um item do array que o backend espera) em vez de uma UI
 * de lista editável — corta bastante complexidade sem perder cobertura do
 * contrato. Grupos secundários reaproveitam os rótulos de
 * `FREE_WORKOUT_GROUPS` como chips (D14 do harness: não inventar taxonomia
 * nova) em vez de texto livre.
 *
 * DECISÃO (mídia): só disponível em EDIÇÃO. As rotas de mídia exigem um
 * `exerciseId` que só existe depois do POST — em vez de um wizard de duas
 * fases dentro do mesmo modal, criar fecha o formulário com os campos de
 * texto, e quem quiser adicionar imagem/vídeo abre "Editar" em seguida. É a
 * simplificação que a própria spec antecipa ("preview não obrigatório se
 * aumentar complexidade").
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, X } from "lucide-react";
import { getExerciseById, searchExercises, type Exercise } from "../../../services/exercisesApi";
import {
  createMyExercise,
  DuplicateExerciseNameError,
  registerYoutubeLink,
  updateMyExercise,
  uploadPersonalExerciseMedia,
  type PersonalExerciseInput,
} from "../../../services/personalExercisesApi";
import { FREE_WORKOUT_GROUPS } from "../../../features/training/freeWorkout/catalogGroups";
import { buildSimilarityCheckQuery, findSimilarExerciseName, type SimilarNameCandidate } from "./similarNameCheck";
import { trackPersonalExerciseEvent } from "./personalExerciseEvents";
import "../personalPremium.css";
import "./personalExercises.css";

// Mesmo regex de `personalExerciseService.ts` (backend) — feedback imediato
// no cliente, mas o backend segue sendo quem valida de verdade.
const YOUTUBE_URL_RE = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/i;
const NAME_SIMILARITY_DEBOUNCE_MS = 400;

interface Props {
  /** `null` = criar; id existente = editar. */
  exerciseId: string | null;
  onClose: () => void;
  /** Disparado após criar/editar com sucesso — quem chama recarrega a lista. */
  onSaved: () => void;
}

export function PersonalExerciseFormModal({ exerciseId, onClose, onSaved }: Props) {
  const isEdit = exerciseId != null;

  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Exercise | null>(null);

  const [name, setName] = useState("");
  const [bodyPart, setBodyPart] = useState(FREE_WORKOUT_GROUPS[0].bodyPart);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  const [equipment, setEquipment] = useState("");
  const [instructionsText, setInstructionsText] = useState("");
  const [tipsText, setTipsText] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDuplicateName, setIsDuplicateName] = useState(false);

  const [similarName, setSimilarName] = useState<SimilarNameCandidate | null>(null);
  const similarCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [youtubeInput, setYoutubeInput] = useState("");
  const [savingYoutube, setSavingYoutube] = useState(false);

  const startedTrackedRef = useRef(false);
  useEffect(() => {
    if (startedTrackedRef.current) return;
    startedTrackedRef.current = true;
    if (!isEdit) trackPersonalExerciseEvent("personal_custom_exercise_create_started");
  }, [isEdit]);

  useEffect(() => {
    if (!exerciseId) return;
    let cancelled = false;
    setLoadingExisting(true);
    setLoadError(null);
    void (async () => {
      try {
        const ex = await getExerciseById(exerciseId);
        if (cancelled) return;
        if (!ex) {
          setLoadError("Exercício não encontrado.");
          return;
        }
        setCurrent(ex);
        setName(ex.name);
        setBodyPart(ex.bodyPart);
        setSecondaryMuscles(ex.secondaryMuscles ?? []);
        setEquipment(ex.equipment ?? "");
        setInstructionsText(ex.instructions.join("\n"));
        setTipsText(ex.tips.join("\n"));
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Não foi possível carregar o exercício.");
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exerciseId]);

  // D11 — aviso não bloqueante de nome parecido no catálogo GLOBAL.
  useEffect(() => {
    if (similarCheckTimer.current) clearTimeout(similarCheckTimer.current);
    const typed = name.trim();
    if (typed.length < 3) {
      setSimilarName(null);
      return;
    }
    similarCheckTimer.current = setTimeout(() => {
      void (async () => {
        try {
          // Não manda o texto digitado inteiro: o backend faz
          // `normalized_name ILIKE '%q%'`, e um nome digitado MAIOR que o do
          // catálogo (ex. "Supino Reto Personalizado" vs "Supino Reto") nunca
          // bateria. Ver `buildSimilarityCheckQuery`.
          const results = await searchExercises({ q: buildSimilarityCheckQuery(typed), limit: 5 });
          const globalOnly = results
            .filter((r) => r.ownerPersonalId == null)
            .map((r) => ({ id: r.id, name: r.name }));
          setSimilarName(findSimilarExerciseName(typed, globalOnly));
        } catch {
          // Aviso é best-effort — falha de busca não pode travar o formulário.
        }
      })();
    }, NAME_SIMILARITY_DEBOUNCE_MS);
    return () => { if (similarCheckTimer.current) clearTimeout(similarCheckTimer.current); };
  }, [name]);

  function toggleSecondary(label: string) {
    setSecondaryMuscles((prev) =>
      prev.includes(label) ? prev.filter((v) => v !== label) : [...prev, label],
    );
  }

  function buildInput(): PersonalExerciseInput {
    return {
      name: name.trim(),
      bodyPart,
      secondaryMuscles,
      equipment: equipment.trim() || undefined,
      instructions: instructionsText.split("\n").map((s) => s.trim()).filter(Boolean),
      tips: tipsText.split("\n").map((s) => s.trim()).filter(Boolean),
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const input = buildInput();
    if (!input.name) {
      setSaveError("Informe o nome do exercício.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setIsDuplicateName(false);
    try {
      if (isEdit && exerciseId) {
        await updateMyExercise(exerciseId, input);
        trackPersonalExerciseEvent("personal_custom_exercise_edited");
      } else {
        await createMyExercise(input);
        trackPersonalExerciseEvent("personal_custom_exercise_created");
      }
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof DuplicateExerciseNameError) {
        setIsDuplicateName(true);
        setSaveError("Você já tem um exercício ativo com esse nome na sua biblioteca. Escolha outro nome ou edite o existente.");
      } else {
        setSaveError(e instanceof Error ? e.message : "Não foi possível salvar o exercício.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleImageChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !exerciseId) return;
    setUploadingImage(true);
    setMediaError(null);
    try {
      await uploadPersonalExerciseMedia(exerciseId, file, { isPrimary: true });
      const refreshed = await getExerciseById(exerciseId);
      if (refreshed) setCurrent(refreshed);
    } catch (e) {
      setMediaError(
        e instanceof Error && e.message === "storage_unavailable"
          ? "Envio de imagem indisponível no momento. Tente novamente mais tarde."
          : "Não foi possível enviar a imagem.",
      );
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSaveYoutube() {
    const url = youtubeInput.trim();
    if (!exerciseId || !url) return;
    if (!YOUTUBE_URL_RE.test(url)) {
      setMediaError("Link do YouTube inválido. Use o formato youtube.com/watch?v=... ou youtu.be/...");
      return;
    }
    setSavingYoutube(true);
    setMediaError(null);
    try {
      await registerYoutubeLink(exerciseId, url, { isPrimary: !primaryImage });
      const refreshed = await getExerciseById(exerciseId);
      if (refreshed) setCurrent(refreshed);
      setYoutubeInput("");
    } catch {
      setMediaError("Não foi possível salvar o link do YouTube.");
    } finally {
      setSavingYoutube(false);
    }
  }

  const primaryImage =
    current?.media.find((m) => m.mediaType !== "youtube" && m.isPrimary) ??
    current?.media.find((m) => m.mediaType !== "youtube") ??
    null;
  const youtubeLink = current?.media.find((m) => m.mediaType === "youtube") ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Editar exercício" : "Criar exercício"}
      className="pxf-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pxf-panel">
        <div className="pxf-header">
          <span className="pxf-title">{isEdit ? "Editar exercício" : "Criar exercício"}</span>
          <button
            type="button"
            className="pp-btn pp-btn--icon pp-btn--ghost"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="pxf-body">
          {loadingExisting ? (
            <p className="pp-meta">Carregando exercício…</p>
          ) : loadError ? (
            <div className="alert alert-danger">
              <AlertTriangle size={16} className="alert-icon" aria-hidden="true" />
              <span>{loadError}</span>
            </div>
          ) : (
            <form id="pxf-form" onSubmit={handleSubmit} className="pxf-form">
              <div className="field">
                <label className="label" htmlFor="pxf-name">Nome</label>
                <input
                  id="pxf-name"
                  className={`input${isDuplicateName ? " input-invalid" : ""}`}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setIsDuplicateName(false); }}
                  maxLength={255}
                  autoFocus
                />
                {similarName ? (
                  <div className="alert alert-info" role="status">
                    <AlertTriangle size={14} className="alert-icon" aria-hidden="true" />
                    <span>
                      Já existe um exercício semelhante no catálogo S2CORE ("{similarName.name}"). Deseja continuar?
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="field">
                <label className="label" htmlFor="pxf-body-part">Grupo muscular principal</label>
                <select
                  id="pxf-body-part"
                  className="input"
                  value={bodyPart}
                  onChange={(e) => setBodyPart(e.target.value)}
                  required
                >
                  {FREE_WORKOUT_GROUPS.map((g) => (
                    <option key={g.bodyPart} value={g.bodyPart}>{g.label}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <span className="label">Grupos secundários (opcional)</span>
                <div className="pxf-checkbox-grid">
                  {FREE_WORKOUT_GROUPS.filter((g) => g.bodyPart !== bodyPart).map((g) => (
                    <label key={g.bodyPart} className="pxf-checkbox-option">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={secondaryMuscles.includes(g.label)}
                        onChange={() => toggleSecondary(g.label)}
                      />
                      {g.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="pxf-equipment">Equipamento (opcional)</label>
                <input
                  id="pxf-equipment"
                  className="input"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  placeholder="Ex.: Barra, halteres, peso do corpo"
                  maxLength={100}
                />
              </div>

              <div className="field">
                <label className="label" htmlFor="pxf-instructions">Execução (opcional)</label>
                <textarea
                  id="pxf-instructions"
                  className="input"
                  rows={4}
                  value={instructionsText}
                  onChange={(e) => setInstructionsText(e.target.value)}
                  placeholder="Um passo de execução por linha"
                />
                <span className="field-hint">Um passo por linha.</span>
              </div>

              <div className="field">
                <label className="label" htmlFor="pxf-tips">Dicas / observações (opcional)</label>
                <textarea
                  id="pxf-tips"
                  className="input"
                  rows={3}
                  value={tipsText}
                  onChange={(e) => setTipsText(e.target.value)}
                  placeholder="Uma dica por linha"
                />
              </div>

              {isEdit ? (
                <div className="field">
                  <span className="label">Mídia</span>

                  <div className="pxf-media-row">
                    {primaryImage ? (
                      <img src={primaryImage.url} alt="" className="pxf-media-thumb" />
                    ) : (
                      <div className="pxf-media-thumb pxf-media-thumb--empty" aria-hidden="true">
                        Sem imagem
                      </div>
                    )}
                    <label
                      className="pp-btn pp-btn--sm pp-btn--ghost"
                      style={{ cursor: uploadingImage ? "not-allowed" : "pointer" }}
                    >
                      {uploadingImage ? "Enviando…" : primaryImage ? "Trocar imagem" : "Adicionar imagem"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: "none" }}
                        disabled={uploadingImage}
                        onChange={(e) => { void handleImageChange(e.target.files); e.target.value = ""; }}
                      />
                    </label>
                  </div>

                  <div className="pxf-media-row">
                    <input
                      className="input"
                      placeholder="Link do YouTube (opcional)"
                      value={youtubeInput}
                      onChange={(e) => setYoutubeInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="pp-btn pp-btn--sm"
                      onClick={() => void handleSaveYoutube()}
                      disabled={savingYoutube || !youtubeInput.trim()}
                    >
                      {savingYoutube ? "Salvando…" : "Salvar link"}
                    </button>
                  </div>
                  {youtubeLink ? (
                    <a href={youtubeLink.url} target="_blank" rel="noopener noreferrer" className="field-hint">
                      Vídeo atual: {youtubeLink.url}
                    </a>
                  ) : null}
                  {mediaError ? <p className="field-error">{mediaError}</p> : null}
                </div>
              ) : (
                <p className="field-hint">Salve o exercício para depois adicionar imagem ou vídeo, em "Editar".</p>
              )}

              {saveError ? (
                <div className="alert alert-danger">
                  <AlertTriangle size={16} className="alert-icon" aria-hidden="true" />
                  <span>{saveError}</span>
                </div>
              ) : null}
            </form>
          )}
        </div>

        <div className="pxf-footer">
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            form="pxf-form"
            className="pp-btn pp-btn--primary"
            disabled={saving || loadingExisting || !!loadError}
          >
            {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar exercício"}
          </button>
        </div>
      </div>
    </div>
  );
}
