<!-- SPECKIT START -->
For project context, conventions, and architecture rules, read the repository
root CLAUDE.md (two levels up). The previous SPECKIT pointer to
specs/003-nutri-mvp/plan.md was stale (repo advanced to specs/019-020) and was
removed in jun/2026; consult the highest-numbered folder under specs/ for the
spec currently in flight.
<!-- SPECKIT END -->

## Design System (S2CORE)

Antes de mexer em QUALQUER UI, leia [`docs/AGENT_DESIGN_SYSTEM_RULES.md`](docs/AGENT_DESIGN_SYSTEM_RULES.md)
(regras) e [`docs/design-system/README.md`](docs/design-system/README.md) (referência).

Essenciais:
- **Cor só por token.** Fonte da verdade: `src/styles/tokens.css`. Primitivos: `src/styles/components.css`. Zero HEX hardcoded.
- **Marca = oliva `#7B9919`** (`--color-primary`): ícones, progresso, estado ativo, texto-sobre-escuro. **Não exagerar no verde.**
- **CTA com texto branco usa `--action-primary` (`#5E7412`), nunca `--color-primary`** — branco sobre oliva vibrante reprova contraste (3.0:1).
- **Fontes:** Manrope (interface) via `--font-sans`; Exo 2 (marca/score, com moderação) via `--font-brand`. Exo 2 nunca em texto corrido/ficha/formulário.
- **Accent cyan `#06B6D4`** só para dados/insights/tracker/metabolismo.
- Refactor visual **nunca** remove função/rota/regra. Rode `npm run build && npm test && npm run lint`.
