# Proposta: QA mobile de layout como rotina recorrente (CI)

Estado: **proposta** — nenhum workflow foi alterado e nada deve bloquear deploy.

## O que existe
- `scripts/qa-mobile-layout.mjs`: matriz de 730 células (9 viewports × perfis × estados) + detectores, classificador e `baseline.json`.
- `scripts/qa-mobile-layout/selftest.mjs`: 109 asserções sintéticas (defeito conhecido + controle negativo).
- `combined-1b.mjs`, `combined-1c.mjs`, `combined-2.mjs`, `combined-3.mjs`: cenários dirigidos com asserções dinâmicas, somente leitura (123, 44, 50 e 114 asserções).

## Dependências
Node 20, Postgres descartável (nome com `test|ci|qa`), backend (`tsx src/index.ts` com `QA_SAFE_MODE=1` e SEM envs de produção),
Vite, Chromium + `playwright-core` (não é dependência do SPA), contas de fixture (`qaDemoFixture`, `qaNutriP1bFixture`, `seed-via-api`).
`--keep-state <dir>` grava sessões (JWT das contas de fixture): nunca apontar para dentro do repositório (`*.state.json` está no `.gitignore`).

## Custo
Matriz completa ≈ 12–15 min com 3–4 workers, ~1,5 GB de RAM; cenários combinados ≈ 1–2 min cada; selftest ≈ segundos.

## Estabilidade
- **Determinísticos (bons para gate):** selftest e os `combined-*.mjs` (medem geometria e hit-test; idênticos em máquina ociosa).
- **Sensíveis a estado/ordem:** detector de alvo pequeno (limite de 80 sondas/página faz alertas "aparecerem" ao resolver outros),
  login limitado a 5/min (o runner espera 65 s), páginas que crescem com dados (os scripts esperam estabilizar), sessão de treino ativo
  que expira em 3 h (regerar o estado a cada execução).
- **Fora de alcance de CI:** GPS, câmera, teclado real, iOS, botão voltar nativo — só aparelho.

## Recomendação
1. Job **separado**, `workflow_dispatch` + agendado (noturno), com `continue-on-error`.
2. Etapas: subir banco/serviços → `selftest` → `combined-*.mjs` → matriz completa.
3. Artefatos: `report.json`, `baseline.json`, `shots/`, `evidence/` + comparação automática com o último baseline (status por ID).
4. **Não** bloquear deploy. Promover a "gate" apenas o `selftest` e os `combined-*.mjs` depois de ~2 semanas verdes.
5. Estabilizar antes de qualquer gate: o limite de sondas do detector de alvos e a dependência de dados do fixture.
