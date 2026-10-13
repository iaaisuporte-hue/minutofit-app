# QA mobile de layout — Onda 0 (baseline)

Mede, **não corrige**. Matriz: 9 viewports × perfis (público, aluno, personal, nutri) × estados
(default, cookie, treino em andamento, offline, safe-area, teclado simulado, overlays) e classifica os
achados do plano de 12/10/2026 (G1–G8, A1–A12, P1–P9, N1) como
**CONFIRMADO / REFUTADO / PARCIAL / BLOQUEADO / NÃO TESTADO**.

## Arquivos

| Arquivo | Papel |
|---|---|
| `../qa-mobile-layout.mjs` | Runner: preflight, login, estados, execução da matriz, evidências, baseline |
| `detectors.mjs` | Detectores que rodam **dentro da página** (corte, alvo de toque por hit-test, rolagem aninhada, cobertura, safe-area, overlays, reserva no fim da página) |
| `scenarios.mjs` | Catálogo: rotas × estados, fluxos reais para abrir modais, passos de medição por achado |
| `classify.mjs` | Regras por ID: onde manifesta, como mede, limitações; descobertas novas; cobertura |
| `selftest.mjs` | Fixtures sintéticas (defeito conhecido + controle negativo). **Rode antes de confiar num baseline** |
| `seed-via-api.mjs` | Semeia o que os fixtures do backend não cobrem, pelos contratos reais da API |
| `summarize.mjs`, `classify-cli.mjs`, `report-md.mjs` | Leitura/reclassificação/relatório de um `report.json` |
| `common.mjs` | Fábrica de contexto (`newMobileContext`), guardas de localhost, utilidades |

## Regras de segurança (não negociáveis)

- **Banco descartável.** O nome precisa conter `test|ci|local|verify|qa`. **Nunca** use o `.env` do backend
  (aponta para produção): passe `DATABASE_URL` explícito e `QA_SAFE_MODE=1`, e zere `AWS_*`, `RESEND_*`,
  `MERCADOPAGO_*`, `OPENAI_*`.
- O runner **recusa** URL que não seja localhost, e só aceita contas de fixture (e-mail `.invalid`).
- A matriz **não grava no banco**: toda escrita da API (exceto login/refresh/switch-academy) é interceptada e registrada
  (`meta.stubbedWrites`). O seed (`seed-via-api.mjs`) é o único passo que escreve.
- Rede hermética: hosts externos são bloqueados; imagens externas viram placeholder.

## Preparação (uma vez por banco)

```bash
# 1. banco descartável (porta 5433 do docker compose)
docker exec corefit-postgres psql -U corefit -d postgres -c "CREATE DATABASE corefit_qa_mobile_layout_test"

# 2. ambiente do backend (arquivo fora do repo; NÃO commitar)
export DATABASE_URL=postgresql://corefit:corefit@localhost:5433/corefit_qa_mobile_layout_test QA_SAFE_MODE=1 \
  NODE_ENV=development PORT=3101 JWT_EXPIRY=12h JWT_REFRESH_EXPIRY=7d SKIP_CAPTCHA=1 \
  JWT_SECRET=<qualquer> JWT_REFRESH_SECRET=<qualquer> FRONTEND_URL=http://localhost:5174 \
  FRONTEND_URLS=http://localhost:5174 AWS_S3_ENDPOINT= AWS_S3_BUCKET= AWS_ACCESS_KEY_ID= \
  AWS_SECRET_ACCESS_KEY= AWS_REGION= RESEND_API_KEY= MERCADOPAGO_ACCESS_TOKEN= OPENAI_API_KEY= SENTRY_DSN=

# 3. schema + catálogo + fixtures (em minutofit-backend/)
npx tsx src/scripts/seedDatabase.ts
npx tsx src/scripts/prepareTestDatabase.ts
npx tsx src/scripts/seedExercisesLibrary.ts
npx tsx src/scripts/qaDemoFixture.ts --setup        # imprime aluno/personal + senhas aleatórias
npx tsx src/scripts/qaNutriP1bFixture.ts            # nutri + paciente

# 4. servidores
npx tsx src/index.ts                                # backend em :3101
VITE_API_URL=http://localhost:3101/api npx vite --port 5174 --strictPort   # SPA (acesse por "localhost")

# 5. credenciais num JSON FORA do repo (chmod 600):
#    { "student":{email,password,id}, "personal":{...}, "nutri":{...}, "patient":{email,id} }
node scripts/qa-mobile-layout/seed-via-api.mjs --creds <creds.json>   # UMA vez por banco
```

`playwright-core` não é dependência do SPA (nada foi instalado): o runner procura uma cópia já existente
(`QA_PLAYWRIGHT_CORE`, `~/.npm/_npx/*`, gstack) e um Chromium em `~/.cache/ms-playwright` (`QA_CHROME`).

## Execução

```bash
node scripts/qa-mobile-layout/selftest.mjs                 # prova que os detectores funcionam (exit 3 se falhar)
node scripts/qa-mobile-layout.mjs --creds <creds.json>     # matriz completa (~12 min, 4 workers)
node scripts/qa-mobile-layout.mjs --creds <creds.json> --only student.session --viewports 390x844,844x390
node scripts/qa-mobile-layout/report-md.mjs <.gstack/qa-reports/mobile-layout-...>   # tabelas em Markdown
```

Saída em `.gstack/qa-reports/mobile-layout-<data>/` (ignorada pelo git): `report.json` (todas as células),
`baseline.json` (status por ID + descobertas novas + cobertura), `shots/` (captura crua **antes** da medição) e
`evidence/` (capturas anotadas dos P1/P2).

Códigos de saída: `0` matriz executada (achados não reprovam) · `2` falha de infraestrutura (ambiente fora do ar
ou inseguro, auth impossível, canário/detector cego, >50% de erro) · `3` (selftest) detector falhou.

## Limites do que se mede (leia antes de citar um número)

- Chromium headless **não é** o WebView do Android nem o WKWebView do iOS. Medem-se **causas** (CSS/geometria);
  o **efeito** em aparelho real aparece como `PARCIAL` com a limitação escrita no achado.
- `isMobile:false + hasTouch:true` de propósito: com `isMobile:true` o Chromium infla `innerWidth` quando o conteúdo
  estoura e **esconde** o defeito que se quer medir.
- Teclado é **simulado** (viewport reduzida ≈ `resizes-content`); não exercita o iOS nem o `--kb-inset` do app.
- Safe-area usa `Emulation.setSafeAreaInsetsOverride` (modela o iOS).
- `vh` × `dvh` por barra de endereço dinâmica, câmera/MediaPipe e botão físico de voltar só se confirmam em aparelho.
