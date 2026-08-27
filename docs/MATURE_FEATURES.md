# 🛡️ Feature Registry — Funcionalidades Maduras (anti-regressão)

Funcionalidades **maduras** = já entregues, com valor de produto comprovado.
**Não podem ser removidas, sobrescritas ou quebradas silenciosamente** por
refatoração, redesign, rebranding ou "limpeza de código morto".

Regras:
- Mudar o **lugar** de um botão é permitido; fazê-lo **desaparecer** exige decisão documentada (PR descrevendo o porquê).
- Toda feature aqui listada tem **testes de regressão**. Se for tocar a feature, rode `npm test` e ajuste os testes conscientemente — não os apague para "passar".
- Antes de refatorar telas de treino, siga o [REGRESSION_CHECKLIST.md](./REGRESSION_CHECKLIST.md).

---

## ⭐ Compartilhamento social de treino

**Classificação:** feature madura · engajamento · **aquisição orgânica** · prova social · ligada ao resumo pós-treino · **protegida contra regressão**.

**Por que importa (produto):** gera prova social e aquisição orgânica natural, reforça a experiência premium, estimula concluir treinos e conecta treino executado + identidade do usuário ao MaaS. Tratada como **estratégica, não cosmética**.

### Onde aparece
- **Resumo do Modo Treino** (pós-execução ao vivo) — `WorkoutSessionPage` (fase `summary`). **Ponto principal.**
- **Ficha / Meu plano** após registrar a sessão — `MyWorkoutPlansPage` (`registeredToday`).

### Componentes / arquivos
| Papel | Arquivo |
|------|---------|
| Botão + abertura do fluxo (reutilizável) | `src/pages/user/components/WorkoutShareTrigger.tsx` |
| Modal (preview, formato, foto, ações) | `src/pages/user/components/ShareWorkoutModal.tsx` |
| Geração do card + share/fallbacks | `src/pages/user/lib/shareWorkoutImage.ts` |
| Uso no Modo Treino | `src/pages/user/WorkoutSessionPage.tsx` |
| Uso na ficha | `src/pages/user/MyWorkoutPlansPage.tsx` |

### Rotas envolvidas
- `/app/user/treino/:planId/:dayIndex` (Modo Treino → resumo)
- `/app/user/ficha` (Meu plano)

### Regras de negócio
- Card gerado via **canvas** (1080×1920 "story" ou 1080² "feed"); foto de fundo é **escolha explícita** do usuário; sem foto, usa gradiente da marca.
- **Mobile:** Web Share API (`navigator.share` com arquivo) → Stories/apps.
- **Desktop / sem Web Share:** fallback **baixar imagem** + **copiar texto** (sempre disponível). O botão **nunca** é escondido por capacidade.
- Disponível para treino de **personal**, **automático/MaaS**, **adaptado** e **executado** — o `focus`/`dayName`/`stats` vêm da sessão, agnóstico à origem.

### Privacidade (obrigatório)
Card/texto contêm **apenas**: nome do app/marca, foco e nome do treino, data, stats seguros (duração, séries feitas/previstas, % conclusão, volume, sequência), **nome dos exercícios executados com séries × reps**, frase/CTA. Desde ago/2026 a **arte** exibe só marca, foco do treino e a mini tabela — data e stats saíram da imagem (decisão visual, para a foto de fundo ter destaque) e seguem apenas no **texto** que acompanha o compartilhamento. **NUNCA**: peso corporal, medidas, dor/fadiga/limitações, dados clínicos, nome de personal/academia/nutri, IDs/dados técnicos, plano/pagamento. Os tipos `WorkoutShareStats` e `WorkoutShareExercise` são a allow-list — não adicionar campo sensível neles.

> A mini tabela "Exercícios executados" (ago/2026) carrega **nome + séries × reps**, mesma classe de dado do resto do card: o que a pessoa fez no treino. **Carga por exercício ficou de fora de propósito** — o volume total já vai na linha de stats, e kg por movimento aproxima a peça de dado corporal comparável. A lista mostra o **executado**, não o prescrito: quem parou no 3º exercício não compartilha uma arte dizendo que fez sete. Teto de 6 linhas (Story) / 3 (feed), com a última gasta em "+N exercícios" quando sobra gente de fora.

### Testes obrigatórios
- `src/pages/user/lib/shareWorkoutImage.test.ts` — texto seguro (não vaza sensível), capacidade, fallbacks e o corte da mini tabela (`buildExerciseRows`).
- `src/pages/user/components/WorkoutShareTrigger.test.tsx` — **botão presente** + **abre o fluxo** no clique.
- `src/pages/user/components/ShareWorkoutModal.test.tsx` — fallback desktop (baixar/copiar) vs share nativo (mobile).

### Critérios mínimos de "funcionando"
1. Usuário conclui treino e **vê** o botão "Compartilhar treino" no resumo.
2. Clicar abre o modal com **preview do card**.
3. Card **não** expõe dado sensível.
4. Mobile compartilha (Web Share); desktop **baixa/copia**.
5. `npm test` verde para os 3 arquivos acima.

### Histórico
- Regressão de jun/2026: o novo **Modo Treino** virou CTA primário e finalizava sem botão de share → a feature ficou **órfã do fluxo principal** (não foi deletada). Restaurada via `WorkoutShareTrigger` no resumo + fallback desktop. Causa raiz: ponto de acesso único acoplado ao fluxo antigo, sem teste de presença do botão (agora coberto).

---

## Outras features maduras (registrar testes ao tocá-las)

| Feature | Onde | Arquivos-chave |
|--------|------|----------------|
| Concluir treino (execução ao vivo) | Modo Treino | `WorkoutSessionPage.tsx`, `workoutSession/` |
| Cronômetro de descanso | Modo Treino | `workoutSession/useRestTimer.ts` · teste: `workoutSession/useRestTimer.test.ts` |
| Resumo pós-treino (volume/aderência/comparação) | Modo Treino | `workoutSession/sessionSummary.ts` |
| Registrar sessão (estruturada + XP/streak) | Ficha + Modo Treino | `workoutSession/registerWorkoutSession.ts` (write-through servidor: 1 chamada grava execução + log + XP/streak na mesma transação) |
| Histórico de treino | Aluno | `components/WorkoutHistorySection.tsx` (Evolução) · `workoutHistory.ts` (cache) · `GET /training/sessions` |
| Ficha prescrita / executada | Ficha | `MyWorkoutPlansPage.tsx` |
| Check-in diário | Hoje | `metabolicCheckin/`, gamification |

> Ao evoluir uma destas, **adicione/atualize testes** e, se vira ponto de acesso de uma feature madura, garanta que o acesso continua existindo no novo fluxo.
