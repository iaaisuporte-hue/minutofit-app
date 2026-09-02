# MOBILE_P0_REPORT — S2CORE Mobile UX Hardening P0

**Data:** 02 set 2026
**Escopo:** SPEC "S2CORE Mobile UX Hardening P0 — Android / iOS"
**Módulos auditados:** Aluno e Personal (os publicados no app empacotado)
**Resultado:** **FAIL** — ver §7. Todo o trabalho de código está feito e verificado; o que
falta é validação em aparelho real, que não pôde ser executada neste ambiente.

---

## 0. Duas limitações do ambiente, declaradas antes de tudo

Elas mudam a leitura de todo o resto e por isso vêm primeiro.

**Não existe projeto iOS.** O repositório tem `android/` e `capacitor.config.ts`, mas
nenhum diretório `ios/`. O app iOS não existe ainda — não é que esteja quebrado. Criar a
plataforma exige macOS + Xcode, indisponíveis aqui. Portanto **nada nesta SPEC foi validado
em iOS** (§37, QA-20, e a metade iOS de §33/§34). As correções são de camada web/Capacitor,
então valem para iOS quando a plataforma for criada — mas isso é previsão, não verificação.

**Não há aparelho Android conectado.** Não há `adb` nem JDK/SDK Android neste ambiente. Os
QAs §37/§38 que exigem hardware (câmera, share sheet real, gesto de voltar, suspensão do
processo pelo sistema) **não foram executados**. O projeto Android também **não foi
compilado** — a mudança em `capacitor.config.ts` é declarativa e lida pelo Capacitor em
runtime, mas exige um build antes de subir.

O que **foi** executado: auditoria e QA em navegador real (Chromium headless, motor idêntico
ao da WebView do Android), autenticado, nos 6 tamanhos da SPEC, contra backend e Postgres
locais, com dados reais (ficha de 3 dias, 16 exercícios). 21 telas do aluno e 9 do personal,
retrato e paisagem.

---

## 1. Problemas encontrados

Severidade: **P0** = perde dado, esconde função crítica ou quebra o uso. **P1** = atrito real.

### P0-1 · O treino era APAGADO quando a rede falhava, e o app dizia "Treino salvo"
`WorkoutSessionPage.confirmFinish` envolvia o registro da sessão inteiro num `try/catch`
comentado como *"gamificação best-effort"*. Com a API fora do ar, o `catch` engolia a falha,
`clearDraft()` apagava o rascunho local e a tela mostrava **"Treino salvo — agora mostre sua
evolução"**. O treino não estava em lugar nenhum.

Reproduzido e confirmado no banco: após finalizar com a API derrubada,
`SELECT count(*) FROM workout_sessions` → **0 linhas**, com o rascunho já apagado.
Basta o elevador da academia. Atinge o fluxo prescrito, que é o principal.

O treino **livre** já fazia certo (mantém o rascunho e oferece nova tentativa) — o prescrito
é que tinha ficado para trás.

### P0-2 · Nenhuma recuperação de sessão ao reabrir o app (§22)
O rascunho sempre sobreviveu a minimizar, ao processo morrer e ao aparelho reiniciar — mas
só era **encontrado** por quem voltasse à URL exata da sessão. O caso real do celular é
outro: o Android mata o app, a pessoa toca no ícone e cai na Hoje. Medido: a Hoje não dizia
nada. O treino continuava lá, invisível.

### P0-3 · Conteúdo por baixo da status bar e da barra de gestos (§7)
`targetSdk 36` (obrigatório pela Play Store) **impõe edge-to-edge** no Android 15+ e ignora
`windowOptOutEdgeToEdgeEnforcement`. O padrão do Capacitor para
`android.adjustMarginsForEdgeToEdge` é **`"disable"`**, e a config do projeto não o
sobrescrevia. Resultado: a WebView ocupa a tela toda e o conteúdo passa sob as barras do
sistema.

`env(safe-area-inset-*)` não resolve: numa WebView Android ele reporta o **recorte do
display** (notch), não as barras do sistema — volta 0 justamente onde a sobreposição
acontece. O app usa esses tokens em 18 lugares e eles estavam corretos; a origem do
problema é a configuração.

### P0-4 · Share sheet e "Baixar imagem" não funcionavam no app empacotado (§18, §19)
Três APIs web usadas pela tela de compartilhar **não existem** na WebView do Android, e as
três falhavam **em silêncio**:

| API | O que acontecia no app |
|---|---|
| `navigator.share` | Não existe na WebView → `canShareWorkoutImage()` = false → o botão **"Compartilhar nos Stories" simplesmente não era renderizado**. A função principal da tela sumia. |
| `<a download>` com data URL | Inerte na WebView → "Baixar imagem" não baixava nada e não dizia nada. |
| `<input capture>` com permissão negada | O chooser fecha sem evento → nada acontece, sem como explicar (§13). |

No app empacotado sobravam "Baixar imagem" (quebrado) e "Copiar texto".

### P0-5 · Logout do personal era um toque acidental de distância (§6)
`Sair` era o **6º slot** do bottom nav do personal, vizinho de "Programas", numa barra de
seis colunas (~53px cada em 320px), e derrubava a sessão **sem perguntar nada**. A SPEC é
explícita: *"não deixar logout como ação acidental"*.

### P0-6 · "Meu perfil" do personal só existia em paisagem (§3, §5)
Confirmado pelo diff retrato×paisagem: `/app/personal/meu-perfil` — onde moram perfil
público, plano, **tema** e exclusão de conta — só era alcançável pela sidebar, que aparece a
partir de 980px. Na prática o personal precisava **deitar o celular** para chegar lá. Este é
exatamente o sintoma que a SPEC descreve em §3.

### P0-7 · Campo em foco ficava embaixo do teclado (§9)
Medido em 360×740 com teclado de 330px: ao focar a carga da 4ª série, a base do campo ficava
em **517px** com apenas **410px** visíveis. O campo **e** o botão "Concluir série"
desapareciam sob o teclado, e nada rolava sozinho. Rolar não bastava: o campo estava no fim
da página e não havia conteúdo abaixo para onde rolar.

### P0-8 · Voltar do Android saía do treino sem avisar e não fechava modal (§32)
`NativeAppBridge` só olhava `canGoBack`. Com um modal aberto, `canGoBack` continua true — o
back **navegava para trás com o diálogo na tela**. Durante o treino, saía da sessão sem
qualquer aviso.

### P1-1 · Alvos de toque abaixo de 44px (§8)
Varredura autenticada nos 6 tamanhos. O mais grave: o **ícone de Mensagens do aluno media
32×32 em todas as telas** (o do personal já tinha 44 — faltava alinhar). Também: `?` do
InfoHint 16×16 (o menor do app), "Marcar como feito" 26×26, botão "← Voltar" 52×19, lápis
"Renomear dia" 10×10, chips de grupo muscular 40px, seletor Casa|Academia 36px, abas
Treino|Alimentação da Ficha 41px, "Iniciar treino →" 43px (o CTA mais tocado, 1px abaixo).

A regra de 44px existia desde ago/2026 mas estava **escopada a `.auth-card`**, com um
comentário registrando que a varredura no app autenticado dependia de um QA logado. Este
relatório é esse QA.

---

## 2. Correções realizadas

| # | Correção | Arquivo |
|---|---|---|
| P0-1 | Falha de rede deixa de apagar o treino: erro na tela, rascunho preservado, "Tentar novamente". Reenvio é seguro — o servidor deduplica pela chave natural (aluno+ficha+dia+dia do aluno) sob advisory lock | `src/pages/user/WorkoutSessionPage.tsx` |
| P0-2 | Detector de treino em andamento + card "Você possui um treino em andamento" com **Continuar treino** / **Encerrar treino** (este último com confirmação que diz o que se perde), montado na **Hoje** e na **Ficha** | `workoutSession/inProgressSession.ts`, `components/ResumeWorkoutCard.tsx`, `TodayPage.tsx`, `MeuPlanoPage.tsx`, `styles/components.css` |
| P0-3 | `adjustMarginsForEdgeToEdge: 'auto'` — aplica as margens de `systemBars() \| displayCutout()` à WebView no Android 15+; nada muda no Android 14 e abaixo | `capacitor.config.ts` |
| P0-4 | Camada nativa nova: share sheet via `@capacitor/share` (arquivo em `Directory.Cache`), salvar via `@capacitor/filesystem` (`Directory.Documents`, sem permissão extra), foto via `@capacitor/camera`. Web/PWA seguem pelo caminho antigo — a decisão é interna | `pages/user/lib/nativeShare.ts` (novo), `components/ShareWorkoutModal.tsx` |
| P0-4b | Permissão de câmera pedida **só no toque de "Tirar foto"** (§13); negada → mensagem da SPEC + "Galeria" continua na tela; cancelar não vira erro. Galeria usa `CameraSource.Photos` (seletor nativo, sem acesso à biblioteca inteira — §14). `width: 1600` limita o bitmap na origem e corrige EXIF (§36) | `pages/user/lib/nativeShare.ts` |
| P0-4c | Feedback de ação (§19, §27): "Imagem salva com sucesso.", "Foto adicionada ao card.", e erros nomeados no lugar do silêncio | `components/ShareWorkoutModal.tsx` |
| P0-5 | Logout sai do bottom nav (volta a 5 destinos) e vira "Meu perfil › Sair da conta" com confirmação "Tem certeza de que deseja sair?" — igual ao aluno | `layout/PersonalMobileBottomNav.tsx`, `pages/PersonalApp.tsx`, `pages/professional/NetworkProfilePage.tsx` |
| P0-6 | Ícone de conta 44×44 no cabeçalho mobile do personal → `/app/personal/meu-perfil`. Segue o padrão documentado da área (destinos no bottom nav + ícones no topo); **não** cria 6º destino | `pages/PersonalApp.tsx` |
| P0-7 | `KeyboardAwareFocus`: abre espaço equivalente ao teclado no container que rola e desloca por **delta calculado** (não `scrollIntoView`, que centraliza na viewport de *layout* e parava 21px abaixo da linha do teclado). Espaço devolvido no blur | `lib/KeyboardAwareFocus.tsx` (novo), `App.tsx` |
| P0-8 | Voltar do Android: fecha primeiro o que estiver por cima (emite `Escape`, contrato que os diálogos já escutam); com treino ao vivo (`data-workout-live`) abre o mesmo diálogo do "Sair" em vez de navegar | `lib/NativeAppBridge.tsx`, `WorkoutSessionPage.tsx` |
| P1-1 | Ícone Mensagens do aluno 32→44. Regra de 44px estendida de `.auth-card` para `.btn`/`.input` no app inteiro (≤719px). `min-height: 44` nos chips de grupo muscular, contexto de treino, seletor do Lab, abas da Ficha, toggles do Tracker, "Iniciar treino", "Abandonar ficha", "← Voltar". Utilitário `.hit-target-44` para o que **precisa** ser pequeno (`?` inline, marcador de exercício, lápis do builder): cresce a área de toque, mantém o desenho | 10 arquivos + `styles/components.css` |
| P0-4d | `WRITE_EXTERNAL_STORAGE` com `maxSdkVersion="28"`: em Android ≤9 (minSdk 23) gravar em Documents exige a permissão, e sem ela o plugin pedia um consentimento que o sistema negava na hora. Nenhuma permissão nova em celular moderno — os plugins de câmera e filesystem não declaram nenhuma | `android/app/src/main/AndroidManifest.xml` |
| — | Código morto removido: `canShareWorkoutImage`, `shareImageBlob`, `downloadComposedImage` (substituídos pela camada nativa) | `pages/user/lib/shareWorkoutImage.ts` |

---

## 3. Problemas não corrigidos

### Não corrigidos por decisão técnica

**Links de texto dentro de frase continuam com 18–28px.** São "registrar", "definir",
"informar", "Ver evolução →", "Gerenciar acesso →", "Ver leitura completa →", "Registrar no
painel do dia →". A WCAG 2.5.8 (Target Size Minimum, AA) **isenta explicitamente** alvos
"in a sentence or block of text", e forçar 44px de altura neles quebraria o entrelinhamento
do parágrafo em que vivem. Aumentá-los seria piorar a leitura para cumprir um número.

**Área ampliada do `?` da Hoje não vence pelo lado de cima.** Medido: acerta no centro, na
esquerda, na direita e embaixo; perde para uma `div` vizinha 18px acima. O alvo efetivo foi
de 16×16 para ~44×36 — melhora grande, mas não perfeita. Tentei `z-index: 1` e não resolveu
(contexto de empilhamento diferente); reverti para não deixar código que não faz o que o
comentário promete.

### Não corrigidos por falta de hardware — **estes são o motivo do FAIL**

- **§37 Android real** e **§37 iPhone real**: sem `adb`, sem JDK/SDK, sem macOS.
- **QA-10, QA-11, QA-14, QA-15, QA-16** (câmera, galeria, share sheet, salvar, permissão
  negada): o código está escrito e coberto por teste unitário com a camada nativa mockada,
  mas **o caminho nativo nunca rodou em aparelho**.
- **QA-19, QA-20** (gesture navigation, notch/Dynamic Island): a correção P0-3 é a
  estruturalmente certa, mas o resultado visual precisa de tela real.
- **§30, parte nativa**: `AppTheme` herda de `Theme.AppCompat.Light.DarkActionBar` (tema
  claro) enquanto o app tem tema próprio. Com edge-to-edge, a faixa atrás das barras passa a
  mostrar o fundo da janela — pode aparecer uma tira clara com o app em modo escuro.
  **Deliberadamente não mexi**: escolher a cor certa exige ver o aparelho, e alterar herança
  de tema sem conseguir compilar arrisca o splash e os diálogos nativos.
- **Botão "Entrar" sob o teclado em 320×568**: medido — com teclado de 268px o campo de
  senha fica visível (295 de 300px) mas o botão fica em 355px. Em 320×568 não cabem os dois.
  Não forcei uma solução sem poder ver o comportamento real do IME.

---

## 4. Testes realizados

**Ambiente:** Chromium (motor da WebView Android), autenticado, backend Node + Postgres
locais em banco criado do zero (`corefit_mobile_test`), contas de QA reais criadas via
`findOrCreateUserFromContext`, ficha de 3 dias com 16 exercícios do catálogo.

**Viewports (todos os 6 da SPEC):** 320×568 · 360×740 · 375×667 · 390×844 · 412×915 · 430×932.

| QA | Resultado |
|---|---|
| QA-01 Login → Home → Perfil → Logout | ✅ Aluno e personal. Botão 119×44, confirmação presente, Cancelar mantém a sessão, Sair leva a `/login` |
| QA-02 Telas em retrato sem scroll horizontal | ✅ **Zero overflow em 21 telas do aluno + 9 do personal × 6 viewports** |
| QA-03 Treino completo | ✅ |
| QA-04 Minimizar durante o treino | ✅ `visibilitychange` → progresso intacto |
| QA-05 Fechar e reabrir | ✅ Contexto novo com o mesmo storage → série preservada |
| QA-06 Sem internet durante o treino | ✅ Tela não quebra, séries continuam sendo lançadas |
| QA-07 Séries offline e reconexão | ✅ 6 séries gravadas offline; ao voltar a rede, salva e limpa o rascunho |
| QA-08 Concluir treino | ✅ Inclusive **com a API fora do ar** (P0-1): erro + rascunho preservado + retomada |
| QA-09 Abrir compartilhamento | ✅ Modal cabe em 320×568 (288×523), scrollável, botão fechar visível |
| QA-10/11 Câmera / galeria | ⚠️ **Só teste unitário** — falta aparelho |
| QA-12 Story 9:16 | ✅ Composição própria, testada |
| QA-13 Feed 1:1 | ✅ Composição própria (teto de linhas diferente), testada |
| QA-14 Share sheet | ⚠️ **Só teste unitário** — falta aparelho |
| QA-15 Salvar imagem | ⚠️ Web ✅ / nativo só teste unitário |
| QA-16 Permissão negada | ⚠️ Só teste unitário (mensagem + fallback verificados) |
| QA-17 Teclado | ✅ Tipos corretos (`decimal` carga, `numeric` reps); campo 517→**398px**, abaixo da linha de 410 do teclado, junto com o botão de concluir |
| QA-18 Aparelho pequeno (320px) | ✅ Sem overflow, modais cabem, bottom nav 64px por item |
| QA-19 Gesture navigation | ⚠️ Correção aplicada, **não validada** |
| QA-20 Notch / Dynamic Island | ⚠️ Correção aplicada, **não validada** |
| §3 Dependência de paisagem | ✅ Diff retrato×paisagem: **nenhuma ação exclusiva de paisagem** no aluno; no personal, "Meu perfil"/tema/logout resolvidos |

**Suítes:** 327 testes do frontend em 36 arquivos (**+11 novos**: 8 de detecção de sessão em
andamento, e a suíte de compartilhamento reescrita para o contrato nativo — formatos,
feedback de salvar, permissão negada, cancelamento). `tsc -b` limpo, `eslint` com 0 erros,
`npm run build` limpo.

> Dois avisos `VAZIO`/`ERR_INSUFFICIENT_RESOURCES` aparecem na varredura em Sugestão de
> treino e Movement Lab. **São exaustão do Chromium headless após 6 contextos sequenciais,
> não defeito**: reexecutadas isoladamente em 320×568, as duas renderizam normalmente
> (1476 e 538 caracteres) com overflow 0.

---

## 5. Evidências

- `SELECT count(*) FROM workout_sessions` → **0** após "Treino salvo" com a API fora do ar
  (P0-1, antes da correção).
- Depois: `"Não foi possível salvar o treino agora. Ele continua guardado neste aparelho —
  tente de novo." | Tentar novamente` · `rascunho preservado? true` · rede de volta →
  `Treino salvo` · `rascunho após sucesso: false`.
- QA-22: `Hoje avisa? ✅ SIM` — *"Você possui um treino em andamento. | 1 de 20 séries ·
  parou em Chest Press Máquina | Continuar treino | Encerrar treino"*, botões 162×44,
  overflow 0. Cancelar mantém o rascunho, confirmar apaga, aviso some.
- Personal 320px e 390px: bottom nav `Hoje | Alunos | Revisões | Financeiro | Programas`
  (logout removido ✅), ícone de conta 44×44 → `/app/personal/meu-perfil` com Aparência ✅ e
  Sair da conta ✅ com confirmação ✅.
- Teclado: `antes 517px → depois 398px` (limite 410) — campo e botão acima do teclado.
- Capturas em `shot-resume-390.png`, `shot-share-320.png`, `shot-sessao-390.png`,
  `shot-save-offline.png` (diretório de trabalho do QA).

---

## 6. Riscos residuais

1. **O caminho nativo nunca rodou em aparelho.** Três plugins novos
   (`@capacitor/share`, `@capacitor/filesystem`, `@capacitor/camera`). O `npx cap sync
   android` **foi executado** e os seis plugins estão registrados no projeto, com
   `adjustMarginsForEdgeToEdge: "auto"` no `capacitor.config.json` gerado — mas o **build
   nunca rodou** (sem JDK/SDK aqui). É o maior risco desta entrega.
2. **`adjustMarginsForEdgeToEdge: 'auto'` muda o layout de TODAS as telas no Android 15+.**
   É a correção certa, mas desloca tudo para dentro das margens de sistema — merece um passe
   visual no primeiro build.
3. **Faixa atrás das barras de sistema pode destoar no tema escuro** (§30, ver §3).
4. **iOS inteiro é território não pisado.** A plataforma não existe; quando for criada,
   `Directory.Documents`, o photo picker e o share sheet têm semânticas próprias.
5. **O piso de 44px em `.btn`/`.input` alcança o app todo em ≤719px.** Sem overflow nem
   quebra nas 30 telas medidas, mas telas não cobertas (Admin, Academia, Nutri) herdam a
   regra sem terem sido auditadas.

---

## 7. Resultado

## FAIL

Os 8 P0 de código foram corrigidos e verificados, e §40 tem 13 dos 18 critérios atendidos com
evidência: paisagem, scroll horizontal, logout, teclado, modais, os dois formatos de card,
treino sobrevive a minimizar, treino sobrevive a reiniciar, perda de rede não apaga treino, e
regressão verde.

Cinco critérios **não podem ser marcados**, e nenhum deles é opinião:

- *"câmera funcionar"*, *"galeria funcionar"*, *"permissão de câmera for contextual"*,
  *"share sheet funcionar"* — implementados, cobertos por teste unitário, **nunca executados
  em aparelho**;
- *"Android real estiver validado"* e *"iOS real estiver validado"* — **impossíveis aqui**:
  não há aparelho, não há SDK, e o projeto iOS não existe.

A SPEC define em §40 que só pode ser concluída com Android e iOS reais validados. Declarar
PASS seria afirmar o que não foi verificado. **Para fechar:** rodar `npx cap sync android`,
gerar o build, executar QA-10/11/14/15/16/19/20 num Android físico — e, para iOS, criar antes
a plataforma num macOS.
