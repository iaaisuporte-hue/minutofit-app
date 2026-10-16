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

## Mobile (Capacitor 7) — Android e iOS

**Um app só:** este SPA React/Vite embrulhado em **Capacitor 7**. Não há Flutter
(`minutofit-mobile/` está vazio — aposentado em jun/2026) e não há segundo app.
Nunca propor Dart, Riverpod/Bloc, Material 3 ou app separado para o personal.

**Stack fixo:** estado = React Context + hooks (**sem** Redux/Zustand/TanStack Query);
HTTP = `fetch` via `src/services/apiClient` (**sem** axios); rotas = `react-router-dom` 7;
testes = Vitest + Testing Library. Tailwind está no `package.json` mas **não é usado**
(zero `@tailwind`/`@apply` em `src/`) — escrever classe Tailwind produz markup sem estilo.

**Plataforma só por `src/lib/platform.ts`** (`isNativeApp()`, `getPlatform()`) — nunca
`Capacitor.getPlatform()` direto. Capacidade que difere web/nativo vira **port**
(interface + `Web*` + `Native*` + factory `create*`), nunca `if` espalhado na UI.
Padrão em `src/features/tracker/ports/`, `features/voiceWorkout/ports/`.

**Comandos:** `npm run lint` · `npm run build` (o `tsc -b` é a análise estática) ·
`npm test` · `npx cap sync` **obrigatório** após mudar `src/`, `public/` ou
`capacitor.config.ts` — sem ele o app nativo empacota código velho (falha silenciosa).
Build de **distribuição** nativa: `VITE_API_URL=https://<api>/api npm run build:native:ios -- --sync`
(ou `:android`). Recusa variável ausente/não-https/host local e varre o bundle atrás de API
local. O `.env` versionado **não** define `VITE_API_URL` — ele vazava `localhost` em todo build.

**Armadilhas já pagas:**
- `versionCode` **nunca** commitado — só `-PversionCode=N`. Queima a cada upload na Play,
  **mesmo rejeitado**. `targetSdk`/`compileSdk` = **36** por exigência da loja.
- **Android 15+ impõe edge-to-edge.** `env(safe-area-inset-*)` **mente** na WebView Android
  (reporta o notch, não as barras). Quem resolve é `adjustMarginsForEdgeToEdge: 'auto'`
  no `capacitor.config.ts` — não "consertar" com CSS. No iOS `env()` funciona.
- `androidScheme: 'https'` → WebView serve de `https://localhost`, que precisa estar no CORS
  do backend. `VITE_API_URL` é obrigatória: sem ela o fallback `${origin}/api` quebra o nativo.
- **Pagamento é oculto no app nativo** (`isNativeApp()`) por política das lojas. Service
  worker e InstallPrompt também não entram no nativo.
- GPS em background não é confiável em WebView — exige plugin nativo dedicado.
- Permissão nativa: diferencie negada / ausente / em uso / falha de init, com retry.
- Cleanup obrigatório no unmount de câmera, geolocalização, watcher, timer e listener —
  em mobile, vazamento é bateria.

**Exige aprovação humana:** `versionCode`, `signingConfig`, `targetSdk`/`compileSdk`,
`AndroidManifest.xml`, `Info.plist`, permissões nativas, plugin Capacitor novo.

**Limites deste ambiente (WSL2/Linux):** build Android local **impossível** (`java`/`gradle`
ausentes) → usar CI `.github/workflows/android-internal-release.yml`; **iOS não compila**
(sem macOS/Xcode/pod) — editar `Info.plist` é possível, afirmar que funciona não é.

**Runbooks:** [`docs/android/ANDROID_INTERNAL_RELEASE.md`](docs/android/ANDROID_INTERNAL_RELEASE.md) ·
`../../docs/ios/IOS_APP_STORE_CHECKLIST.md`

**Agentes mobile:** `mobile-architect` (planeja) → `mobile-engineer` / `mobile-ui`
(implementam) → `mobile-qa` (verifica) → `mobile-reviewer` (revisa).
Skills: `/feature-planning`, `/release-check`.
