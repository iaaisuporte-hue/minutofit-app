# Homologação Android — Onda 2 (Aluno)

Checklist dirigido para aparelho físico. **Nada aqui foi verificado em aparelho:** a Onda 2 foi validada só em Chromium
(simulação). Marque cada item no aparelho; os que dependem de GPS, câmera ou toque real **não** devem ser dados como
homologados por simulação.

**Build:** gerar pelo workflow `android-internal-release.yml` (versionCode automático, faixa *interna*). Não publicar
em produção sem autorização.

**Aparelhos sugeridos:** um Android de tela pequena (≈360×640 dp) e um com recorte/notch; testar retrato e paisagem.

| # | Cenário | Como testar | Esperado | OK |
|---|---|---|---|---|
| 1 | Treino em paisagem (A5) | Iniciar um treino, girar o aparelho | Exercício atual legível (≈45% da altura ou mais); "Concluir série", "Substituir exercício" e "Sair" tocáveis; nada sob o notch | ☐ |
| 2 | Registro de séries | Ajustar carga/reps pelos passos ± e digitar com o teclado aberto | Campo e "Concluir série" visíveis com o teclado; sem salto de layout ao abrir/fechar | ☐ |
| 3 | RPE e descanso (A6) | Concluir uma série; marcar RPE 6–10; "Ignorar"; +15s/+30s/Pausar/Pular | Todos com alvo confortável (≥44px); em tela estreita o RPE vira 2 linhas sem estourar | ☐ |
| 4 | Resumo do treino (A6) | Finalizar o treino | RPE "Leve/Moderado/Intenso/Máximo" em 4 colunas (2×2 em tela estreita); sem espaço vazio enorme no fim | ☐ |
| 5 | Player de exercícios (A2) | Treinos → player; deixar terminar | Painel "Leitura atualizada" com os dois botões visíveis em retrato e paisagem | ☐ |
| 6 | Tracker e mapa (A9) | Iniciar sessão com GPS; arrastar a página com o dedo sobre o mapa; tocar em "Mover mapa" | Arrastar sobre o mapa **rola a página**; com "Mover mapa" ligado o mapa se move/pinça; zoom +/− sempre funciona; Pausar/Encerrar alcançáveis. **Depende de GPS real** | ☐ |
| 7 | Lab de Movimento (A12) | Abrir o Lab com a câmera | Quadro inteiro visível (faixas pretas em vez de recorte), corpo todo enquadrado, controles acessíveis. **Depende de câmera real** | ☐ |
| 8 | Banner e mini-player (paisagem) | Limpar dados do app (1º acesso), treino em andamento, paisagem | Banner em uma faixa; botões "Recusar opcionais"/"Salvar preferências" tocáveis; sobra área útil de conteúdo; nav e mini-player não se sobrepõem | ☐ |
| 9 | Teclado e safe-area | Campos de texto em Perfil/Treino; gestos de borda | Nada atrás do teclado; nada sob barras de status/navegação (Android 15+ edge-to-edge) | ☐ |
| 10 | Botão voltar nativo (1C, ainda pendente) | Com um modal aberto, tocar em voltar | Fecha o modal antes de navegar; em "salvando" não fecha | ☐ |
| 11 | Bottom nav compacta (paisagem) | Girar em qualquer tela do Aluno | 5 itens com rótulo legível e toque fácil | ☐ |

**Registro:** aparelho/modelo, versão do Android, orientação, resultado e foto/captura de tela de qualquer falha.
