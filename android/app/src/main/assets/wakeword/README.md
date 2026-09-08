# Wake word ONNX (P5C — spike aberto)

Motor alternativo ao Picovoice Porcupine, em avaliação — nenhum é definitivo.
Ver `docs/produto/voice_workout_wake_word_spike_onnx.md` no repo pai para o
diagnóstico completo, e `tools/wakeword/` para o pipeline de treino.

## O que já está aqui

- `melspectrogram.onnx` (1.087.958 bytes) e `embedding_model.onnx`
  (1.326.578 bytes) — artefatos **oficiais** do projeto
  [openWakeWord](https://github.com/dscripka/openWakeWord) (Apache-2.0),
  baixados do release `v0.5.1`. São genéricos: convertem áudio em mel-
  espectrograma e depois em um embedding de 96 dimensões — não conhecem
  nenhuma palavra específica, então não precisam ser retreinados por nós.

## O que falta (não está neste repositório)

- `classifier_s2core.onnx` — classificador da keyword "S2CORE"
- `classifier_ei_s2core.onnx` — classificador da keyword "Ei S2CORE"

Os dois são treinados com **gravações reais em pt-BR** (não sintéticas —
ver `tools/wakeword/README.md` para o motivo) e ficam de fora do git
(`.gitignore`) até o spike ser validado ou descartado — são artefato de
treino, não código, e específicos de quem gravou os dados.

**Sem os dois arquivos, `OnnxWakeWordController.iniciar()` reporta
`onError("model_missing")` e não derruba o app** — mesmo tratamento que o
Porcupine já tem para `.ppn` ausente.

## Como colocar um classificador treinado aqui

1. Rode o pipeline em `tools/wakeword/` (repo pai) até a etapa de export.
2. Copie o `.onnx` exportado para `classifier_s2core.onnx` ou
   `classifier_ei_s2core.onnx` nesta pasta.
3. Defina `WAKE_WORD_ENGINE=onnx_spike` em `android/wakeword.properties`
   (copie de `wakeword.properties.example`).
4. Rebuild.

## Atribuição

- `melspectrogram.onnx` / `embedding_model.onnx`: openWakeWord, Apache-2.0,
  [dscripka/openWakeWord](https://github.com/dscripka/openWakeWord).
- Arquitetura de captura/inferência do `OnnxWakeWordController.java`
  (repo pai): adaptada como referência de
  [alfiedennen/mr-graves](https://github.com/alfiedennen/mr-graves)
  (MIT) — não copiada literalmente; ver comentário no topo do arquivo.
