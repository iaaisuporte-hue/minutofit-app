# MOBILE_BACKLOG — achados fora do escopo do P0

Registrado conforme SPEC §42: o que apareceu durante a auditoria e **não** foi implementado,
para não expandir a SPEC. Nada aqui foi tocado no P0.

Classificação: **P1** = atrito real, próximo ciclo · **P2** = melhoria · **Future** = fase própria.

---

## P1

### 1. Alvos de toque de 29–38px em controles autônomos
Sobraram depois da varredura do P0, todos entre 29 e 38px — acima do pior caso, abaixo do
mínimo. Não entraram porque cada um mora num estilo inline diferente e exigiria re-verificar
o layout de cada tela:

| Controle | Tamanho | Tela |
|---|---|---|
| `Configurar agora` | 123×29 | Hoje |
| `Escolher nutricionista…` | 92×29 | Minha equipe |
| `Ver demonstração` | 126×31 | Sugestão de treino |
| `Recarregar` | 118×37 | Sugestão de treino |
| `Rosca Direta` / `Elevação Lateral` | ~120×38 | Movement Lab, Espelho |
| `Localização desativada — toque para rever` | 314×34 | Tracker |
| `7d` (seletor de período) | 33×23 | Hoje |
| `IA` (aba do cockpit) | 38×44 | Personal › Aluno |

**Sugestão:** um utilitário de chip com piso de 44px no design system, aplicado de uma vez,
em vez de oito correções pontuais.

### 2. Indicador de sincronização (§24)
A SPEC pede estados discretos "Salvo / Salvando… / Sincronização pendente / Erro ao
sincronizar". O P0 entregou o essencial — a série **nunca se perde** e a falha ao finalizar é
explícita —, mas não há indicador contínuo durante o treino. Ficou de fora por ser
apresentação sobre um problema já resolvido, não proteção de dado.

### 3. Fila de sincronização real (§23)
Hoje a tolerância a rede é o rascunho local + nova tentativa manual. Uma fila que reenvia
sozinha ao voltar a conexão (usando a `client_key` que já dá idempotência) removeria o passo
manual. Precisa de decisão de produto sobre reenvio em segundo plano.

### 4. Faixa de sistema no tema escuro (§30)
`AppTheme` herda de `Theme.AppCompat.Light.DarkActionBar` enquanto o app tem tema próprio.
Com edge-to-edge, a área atrás das barras mostra o fundo da janela — possível tira clara com
o app em escuro. Exige aparelho para escolher a cor e um build para validar splash e
diálogos nativos.

### 5. Botão "Entrar" sob o teclado em 320×568
Medido: com teclado de 268px o campo de senha fica visível (295 de 300px), o botão fica em
355px. Em 320×568 não cabem os dois. Alternativas: submeter no "ir" do teclado, ou uma barra
de ação ancorada ao teclado.

---

## P2

### 6. Área de toque do `?` não vence pelo lado de cima
`.hit-target-44` levou o alvo de 16×16 para ~44×36: acerta no centro, esquerda, direita e
embaixo; perde para uma `div` vizinha 18px acima. Resolver exige mexer no contexto de
empilhamento da Hoje.

### 7. Links inline: revisar caso a caso
Os alvos de 18–28px em frase são **isentos** pela WCAG 2.5.8 e foram deixados de propósito.
Alguns talvez devessem virar botões autônomos por hierarquia — decisão de design, não de
acessibilidade. Candidatos: "Registrar no painel do dia →" (176×28) e
"Ver leitura completa →" (largura total × 18).

### 8. Projeto iOS não existe
Não há `ios/`. Criar a plataforma, validar safe areas com Dynamic Island, photo picker,
share sheet e swipe-back (§33) é trabalho próprio, com macOS.

### 9. Aparelhar as demais áreas para mobile
A regra de 44px em `.btn`/`.input` (≤719px) alcança Admin, Academia e Nutri, que **não foram
auditados** — a SPEC limitou o escopo aos módulos publicados. Vale a mesma varredura.

### 10. Cobertura de teste do caminho nativo
`nativeShare.ts` é testado com a camada mockada. Um teste de integração em emulador/aparelho
(Appium ou similar) fecharia a lacuna que causou o FAIL desta entrega.

---

## Future — explicitamente fora, conforme §42

Registrados só para não se perderem. **Não implementar sem SPEC própria.**

- Widget Android / iOS
- GPS tracker completo, mapa de corrida, distância, ritmo
- Health Connect · Apple Health · Garmin
- Workout Live Activity (iOS)
- Wear OS · Apple Watch
- Notificações inteligentes
- Readiness e recomendação automática de treino

---

## Observação de método

Duas lições que valem para a próxima auditoria mobile:

1. **Medir com a página em `scrollY=0` produz falso positivo em massa** — já registrado no
   QA de ago/2026 e confirmado de novo aqui: sempre `scrollIntoView` antes de reportar.
2. **Contar `env(safe-area-inset-*)` no código não prova safe area** — o app tinha os tokens
   certos em 18 lugares e ainda assim desenhava sob as barras do sistema, porque a causa
   estava na configuração do Capacitor. Auditoria mobile de app empacotado precisa ler a
   config nativa, não só o CSS.
