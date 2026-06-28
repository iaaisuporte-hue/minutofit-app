# ✅ Checklist anti-regressão — telas de treino

Rodar **antes de mergear** qualquer alteração de UI/UX/fluxo em telas de treino
(Modo Treino, ficha, resumo, histórico, hoje). Complementa o
[MATURE_FEATURES.md](./MATURE_FEATURES.md).

## Sempre que mexer em tela de treino
- [ ] A tela ainda permite **concluir treino**?
- [ ] A tela ainda mostra **resumo** pós-treino?
- [ ] A tela ainda permite **compartilhar treino**? (o botão pode mudar de lugar, **não** sumir)
- [ ] O **histórico** continua sendo gravado (`/training/sessions`)?
- [ ] **Permissões/planos** continuam respeitados?
- [ ] Funciona em **mobile** (bottom sheet, toque, Web Share)?
- [ ] Há **fallback** aceitável em **desktop** (baixar/copiar)?
- [ ] **Não** expõe dado sensível (peso, dor, clínico, personal/academia, IDs, plano)?

## Quando trocar/criar um fluxo que vira CTA primário
> Foi exatamente o que causou a regressão do share em jun/2026.
- [ ] O novo fluxo **reexpõe** os pontos de acesso de features maduras que ele substitui?
- [ ] Os botões maduros (compartilhar, concluir, histórico) existem no **novo** destino?
- [ ] Existe **teste de presença** do botão no novo fluxo?

## Antes de remover "código não usado"
- [ ] Conferi se o componente está no [MATURE_FEATURES.md](./MATURE_FEATURES.md)?
- [ ] Conferi `git grep` do nome do componente **e** dos data-testid?
- [ ] Se está órfão, a causa é "ninguém chama" ou "o novo fluxo esqueceu de chamar"? (o segundo é bug, não código morto)

## Gate de CI
- [ ] `npm run lint` ✅
- [ ] `npm run build` ✅
- [ ] `npm test` ✅ (inclui os testes de regressão do compartilhamento)
