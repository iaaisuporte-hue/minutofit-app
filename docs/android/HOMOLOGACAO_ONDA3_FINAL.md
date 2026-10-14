# Homologação em aparelho — Onda 3 (encerramento do QA mobile)

Complementa — não substitui — `HOMOLOGACAO_ONDA2_ALUNO.md`. **Nada aqui foi verificado em aparelho**: tudo o que a
Onda 3 mediu foi em Chromium (simulação). A aprovação da "Onda 1D" não cobre estas alterações (posteriores a ela).

**Build:** workflow `android-internal-release.yml` (faixa interna; `versionCode` automático). iOS não compila neste ambiente:
as colunas iOS são pendências de WebKit.

## Android

| # | Cenário | Como testar | Esperado | OK |
|---|---|---|---|---|
| 1 | Chat do Aluno (A7) | Mensagens → abrir conversa; digitar com o teclado aberto; enviar; paisagem | Lista rola por dentro; campo e **Enviar** sempre à vista acima da nav; ao abrir o teclado o campo não fica atrás | ☐ |
| 2 | Hoje: toques | Seletor 7d/14d/30d/90d, "Ver evolução", "Ver leitura completa" | Acertam sem mira; sem toque duplo acidental | ☐ |
| 3 | Reordenar exercício (P1) | Builder → adicionar 3 exercícios → ↑/↓ no 2º | Troca de lugar; foco acompanha; salvar mantém a ordem | ☐ |
| 4 | Builder com teclado | Editar Séries/Reps com o teclado aberto, retrato e paisagem | Campo visível/alcançável; Salvar acessível | ☐ |
| 5 | Mensagens do Personal (P2) | Abrir conversa; escolher modelo de resposta; digitar; enviar | Campo + Enviar à vista; modelos rolam na horizontal; sem rolar a página inteira | ☐ |
| 6 | Revisão de ficha (P3) | Revisões → Revisar | Fechar (✕) no cabeçalho; Aprovar/Pedir ajustes sempre visíveis; **botão voltar** fecha o modal | ☐ |
| 7 | Abas de Programas (P6) | Programas em tela estreita | Borda direita esmaecida; dá para chegar em "Meus Exercícios" | ☐ |
| 8 | Menu Nutri (N1) | Menu → Pacientes; Menu → Sair da conta | Menu fecha ao navegar; Sair pede confirmação; voltar fecha o menu | ☐ |
| 9 | Cockpit inline (P5) | Aluno → cockpit | Sem caixa com rolagem dentro da página | ☐ |
| 10 | Pendências da Onda 2 | Itens 1–11 do checklist da Onda 2 (paisagem, mapa/GPS, Lab/câmera, banner+mini-player) | Conforme aquele documento | ☐ |
| 11 | Safe-area e overlays (1C) | Modais com teclado, home indicator, botão voltar | Conforme relatório da Onda 1C | ☐ |

## iOS (pendente — WebKit real)

- **Zoom de inputs (P9):** focar campos do builder, mensagens rápidas, observações e o compositor de mensagens do Personal: a
  página **não** pode dar zoom nem ficar deslocada (fonte ≥ 16px em `pointer: coarse` foi aplicada, mas só se comprova no iOS).
- **Teclado:** o iOS **não** encolhe a viewport (o app usa `--kb-inset`): conferir A7, P2, builder e revisão com o teclado.
- **Safe-area:** `env(safe-area-inset-*)` reais (notch, home indicator, paisagem) nos overlays, no Modo Treino e no chat.
- **`:has()`**: P2 (thread do Personal) e N1 dependem de `:has()`/`<details>` — conferir em iOS < 15.4 (fallback é o layout antigo).
- **`max-height:100%` em grid/flex** dos modais (WebKit) e o esmaecimento (`mask-image`) das abas.

**Registro:** aparelho/modelo, versão do sistema, orientação, resultado e captura de tela de cada falha.
