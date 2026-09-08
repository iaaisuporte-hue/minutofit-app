# Modelos do Porcupine (P5C — spike técnico, sem fornecedor definitivo)

Ver a decisão registrada em `docs/produto/voice_workout_wake_word_decision.md`
(repo pai) antes de mexer aqui: isto é um **trial de 7 dias**, não um
compromisso comercial.

## O que já está aqui

`porcupine_params_pt.pv` — modelo acústico de português (genérico, o mesmo
para qualquer keyword), baixado do repositório oficial da Picovoice
(`Picovoice/porcupine`, licença Apache 2.0). Não precisa de conta nem de
AccessKey para obter este arquivo — é o mesmo para todo mundo que usa
Porcupine em português.

## O que FALTA — só você pode gerar

Dois arquivos `.ppn`, treinados no [Picovoice Console](https://console.picovoice.ai/)
(precisa de conta — o trial de 7 dias começa ao criar uma):

1. Faça login no Console.
2. Em **Porcupine → Create Wake Word**, escolha **idioma Português**.
3. Crie a primeira keyword digitando a forma FALADA, não a marca escrita —
   teste variações como `esse dois core` / `es dois core` até o preview
   soar razoável. Baixe o modelo para **Android**.
4. Repita para a segunda variante: `ei esse dois core` (ou `ei s2core`).
5. Renomeie os dois arquivos baixados e salve exatamente com estes nomes,
   nesta pasta:
   - `keyword_s2core.ppn`
   - `keyword_ei_s2core.ppn`

Sem esses dois arquivos, `WorkoutForegroundService.wakeWordDisponivel()`
continua `false` (falta o AccessKey também — ver abaixo) e o app cai
automaticamente para push-to-talk, sem quebrar nada.

## AccessKey

1. No Console, copie o **AccessKey** da sua conta de trial.
2. Copie `android/picovoice.properties.example` para `android/picovoice.properties`
   (mesma pasta de `keystore.properties` — arquivo local, nunca commitado,
   já está no `.gitignore`).
3. Preencha `PICOVOICE_ACCESS_KEY=` com a chave copiada.

## Depois de configurar os três itens (2 `.ppn` + AccessKey)

Um `./gradlew assembleDebug` (ou o build do Android Studio) já compila com
wake word habilitada atrás da flag `voice_workout`. Sem os três, o app
continua funcionando exatamente como hoje — push-to-talk, sem wake word,
sem erro visível ao usuário.

## Protocolo de teste em aparelho real

Ver `docs/produto/voice_workout_wake_word_test_protocol.md` no repo pai —
criado junto com esta integração, ainda sem nenhum resultado preenchido.
