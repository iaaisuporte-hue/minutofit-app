# Android Internal Release — CI/CD para o Teste Interno da Play Store

Automação que builda o S2CORE Android, gera o `.aab` assinado e publica
**exclusivamente na faixa `internal`** do Google Play. Não existe caminho
automático para closed/open testing ou production — isso continua manual,
de propósito.

Workflow: [`.github/workflows/android-internal-release.yml`](../../.github/workflows/android-internal-release.yml)
(`workflow_dispatch`, nunca dispara em push).

## Pipeline

```
checkout (branch main obrigatória)
↓ npm ci
↓ lint · test · build (tsc -b + vite build)
↓ npx cap sync android
↓ JDK 17
↓ versionCode = 100 + número da execução do workflow
↓ keystore restaurado a partir de secrets (nunca commitado)
↓ ./gradlew bundleRelease -PversionCode=N
↓ AAB salvo como artifact do workflow (14 dias)
↓ dry_run=false → upload ao Google Play, faixa internal, status completed
```

Se `lint`, `test`, `build` ou `bundleRelease` falharem, nada é publicado.

## Setup manual (uma vez só)

Nada disto é automatizável sem credenciais — siga na ordem.

### 1. Google Cloud + Play Developer API

- [ ] Criar (ou reusar) um projeto no Google Cloud Console
- [ ] Habilitar a **Google Play Android Developer API** nesse projeto
- [ ] Em **IAM & Admin → Service Accounts**, criar uma service account
      (ex.: `s2core-play-ci@<project>.iam.gserviceaccount.com`)
- [ ] Gerar uma chave JSON para essa service account e baixar o arquivo

### 2. Conceder acesso no Play Console

- [ ] Play Console → **Configurações → Acesso à API** → vincular o projeto Cloud
      (se ainda não estiver vinculado)
- [ ] Convidar a service account em **Usuários e permissões**
- [ ] Conceder **apenas** ao app S2CORE (`com.s2core.app`) as permissões:
      - **Editar releases de produção, faixas de teste fechado e faixas de teste aberto e interno**
      - **Ver informações do app** (leitura básica, necessária para o upload)
- [ ] Não conceder acesso financeiro, gestão de usuários nem acesso a outros apps

### 3. Keystore de release

O projeto **já tem** um keystore local (usado nos uploads manuais anteriores,
`versionCode` 1–7). **Reusar o mesmo arquivo** — nunca gerar um novo, ou o
Play rejeita o upload por assinatura divergente.

- [ ] Converter o `.jks`/`.keystore` existente para base64:
      `base64 -w0 caminho/para/release.keystore > release.keystore.b64`
- [ ] Ter em mãos: senha da store, alias da chave, senha da chave
      (os mesmos valores que já estão no `keystore.properties` local)

### 4. GitHub — Environment e Secrets

- [ ] Repositório `iaaisuporte-hue/minutofit-app` → **Settings → Environments**
      → criar `google-play-internal`
      (opcional, mas recomendado: exigir revisão manual antes do job rodar)
- [ ] Nesse environment, criar os secrets:

| Secret | Conteúdo |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | conteúdo do `.b64` gerado no passo 3 |
| `ANDROID_KEYSTORE_PASSWORD` | senha da store |
| `ANDROID_KEY_ALIAS` | alias da chave |
| `ANDROID_KEY_PASSWORD` | senha da chave |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | conteúdo **completo** do JSON da service account (passo 1) |

Nenhum destes valores deve existir em arquivo commitado, PR, log ou issue.

## Como disparar uma release

1. GitHub → **Actions** → **Android Internal Release** → **Run workflow**
2. Branch: `main` (é a única aceita — o workflow falha em qualquer outra)
3. Primeira vez: deixe `dry_run = true` — valida o pipeline inteiro (lint,
   testes, build, assinatura, `.aab`) **sem** subir nada ao Play
4. Baixe o artifact gerado e confira se o AAB abre/instala normalmente
5. Rode de novo com `dry_run = false` e `release_notes` preenchido para
   publicar de fato no Teste Interno

## Versionamento

`versionCode` é calculado em CI (`100 + número da execução`) e passado ao
Gradle via `-PversionCode=N` — **nunca** é escrito de volta no repositório.
Builds locais/Android Studio continuam usando o fallback fixo em
`android/app/build.gradle` (linha `versionCode project.hasProperty(...)`).
`versionName` não muda automaticamente; edite manualmente em
`android/app/build.gradle` quando for o caso (ex.: antes de uma versão maior).

## Rollback / interromper uma release interna

Isto **não** cria automação de produção nem promove nada — é só como reverter
um teste interno malfeito:

- **Parar antes de publicar**: cancele a execução do workflow em Actions
  antes do step de upload — nada chega ao Play.
- **Já publicado no interno e quer voltar a uma versão anterior para os
  testadores**: Play Console → app → **Teste → Teste interno** → histórico de
  releases → selecione a release anterior → **Promover release** (ou crie uma
  nova release manual apontando para o `.aab` anterior, baixado do artifact
  do workflow correspondente, mantido por 14 dias).
- Nenhum destes passos toca closed/open testing ou production.

## Troubleshooting

| Sintoma | Causa provável |
|---|---|
| Falha em "Garantir branch main" | Workflow disparado fora de `main` |
| Falha em "Restaurar keystore" | Secret `ANDROID_KEYSTORE_BASE64` ausente/errado no environment `google-play-internal` |
| `bundleRelease` falha silenciosamente sem assinar | Alguma variável do `keystore.properties` gerado está vazia — revisar os 4 secrets |
| Upload ao Play falha com erro de permissão | Service account sem acesso ao app `com.s2core.app`, ou API não habilitada |
| Upload ao Play falha com `versionCode already used` | Aumentar `BASE_VERSION_CODE` no workflow (linha `env:`) para acima do maior já publicado |
| AAB não encontrado | `bundleRelease` falhou antes de gerar saída — ver logs do step anterior |
