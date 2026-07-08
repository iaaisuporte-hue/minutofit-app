# Regras do Design System — Agentes de IA & Devs

Regras **obrigatórias** ao mexer em qualquer UI da S2CORE. Referência completa:
[`docs/design-system/README.md`](./design-system/README.md).

## Nunca

1. **Nunca** use cor fora dos tokens. Zero HEX hardcoded na tela — consuma `var(--...)` de [`tokens.css`](../src/styles/tokens.css).
2. **Nunca** use fonte fora de **Manrope** (interface) e **Exo 2** (marca/score). Exo 2 nunca em texto corrido, ficha, formulário ou tabela.
3. **Nunca** crie um Button novo sem checar `.btn` + variantes em [`components.css`](../src/styles/components.css).
4. **Nunca** crie Card novo sem checar `.card`/`.card-accent`/`.section-card`.
5. **Nunca** crie input/checkbox/radio/toggle novo sem checar `.input`/`.field`/`.checkbox`/`.radio`/`.switch`.
6. **Nunca** ponha **texto branco sobre o oliva vibrante `#7B9919`** (3.0:1). CTA com texto branco usa `--action-primary` (`#5E7412`, 4.84:1).
7. **Nunca** use verde para erro/alerta. Semântica é fixa: erro é vermelho.
8. **Nunca** altere a identidade visual sem atualizar o Design System (`docs/design-system/`).
9. **Nunca** remova funcionalidade, rota, permissão ou regra durante refactor visual.
10. **Nunca** expanda o accent cyan (`--color-accent`) para além de dados/insights/tracker/metabolismo.

## Sempre

- **Sempre** valide contraste (texto ≥ 4.5:1 · gráfico/ícone ≥ 3:1). Ver a tabela do oliva no README §2.
- **Sempre** valide mobile (cards empilham, alvos ≥ 44px, sem scroll horizontal).
- **Sempre** cubra os estados: `loading`, `empty`, `error`, `success`.
- **Sempre** use ícone + texto para status — cor nunca sozinha.
- **Sempre** evite duplicação visual entre módulos — reuse o primitivo.
- **Sempre** rode `npm run build` + `npm test` + `npm run lint` antes de concluir.

## Tokens que você mais vai usar

```css
/* Marca / ação */
--color-primary        /* #7B9919 oliva: ícones, progresso, ativo, borda, texto-sobre-escuro */
--color-primary-hover  /* #91B51E */
--color-primary-deep   /* #5E7412 */
--action-primary       /* #5E7412 fundo de CTA com texto branco */
--action-primary-text  /* #F5F5F5 texto do CTA */

/* Superfície / texto */
--background-primary  --surface-card  --surface-card-hover
--text-primary  --text-secondary  --text-inverted
--border-default  --border-strong

/* Fonte */
--font-sans   /* Manrope — interface */
--font-brand  /* Exo 2 — marca/score */

/* Status (imutáveis) */
--status-success  --status-warning  --status-danger  --status-info
```

## Padrão de CTA (copiar/colar)

```tsx
// CTA primário — texto branco no oliva profundo (AA)
<button className="btn btn-primary">Registrar treino</button>

// inline (quando className não der): use action tokens, NÃO --color-primary
style={{ background: "var(--action-primary)", color: "var(--action-primary-text)" }}
```

## Antes de abrir PR
Rode o grep anti-regressão — deve dar **0**:
```bash
grep -rnE "#22C55E|#16A34A|#1DB954" src/ --include=*.tsx --include=*.ts --include=*.css | grep -v /android/
```
