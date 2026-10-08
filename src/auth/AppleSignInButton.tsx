import { useState } from "react";
import { isNativeApp } from "../lib/platform";
import { signInWithAppleNative } from "./appleNativeAuth";

/**
 * Botão "Continuar com a Apple".
 *
 * Não é feature nova: é paridade obrigatória. A guideline 4.8 exige Sign in
 * with Apple em todo app que ofereça login social de terceiro (aqui, Google) —
 * e a rejeição vem também quando o botão existe mas aparece com hierarquia
 * inferior à do concorrente. Por isso ele usa exatamente a mesma caixa do botão
 * nativo do Google (`GoogleSignInButton`): 44px de altura, largura do
 * container, mesma borda e mesmo peso de fonte.
 *
 * Dois caminhos, um destino:
 * - **Web**: `appleid.auth.js` (o script já vem em `index.html`), em popup.
 * - **App empacotado**: fluxo nativo do sistema (`appleNativeAuth.ts`).
 *
 * Nos dois casos o resultado é o `identityToken` que
 * `authApi.loginWithProvider("apple", ...)` já sabe enviar — backend intocado.
 *
 * As cores saem de token (`--color-surface` / `--color-text` / `--color-border`),
 * o que produz o botão claro com contorno no tema claro e o escuro no tema
 * escuro — as duas variantes que a Apple permite — sem HEX fixo.
 */

/** Services ID criado no portal da Apple. Só o caminho web precisa dele. */
function clientId(): string | undefined {
  return import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;
}

/**
 * URL de retorno registrada no Services ID. Precisa bater exatamente com o que
 * está no portal, senão a Apple recusa com `invalid_request` antes de mostrar
 * qualquer tela. O padrão é a origem que serviu a página.
 */
function redirectUri(): string {
  const configurado = import.meta.env.VITE_APPLE_REDIRECT_URI as string | undefined;
  return configurado || window.location.origin;
}

const APPLE_SRC =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

type AppleIdApi = {
  auth: {
    init: (options: Record<string, unknown>) => void;
    signIn: () => Promise<{
      authorization?: { id_token?: string };
      user?: { email?: string; name?: { firstName?: string; lastName?: string } };
    }>;
  };
};

function appleId(): AppleIdApi | undefined {
  return (window as unknown as { AppleID?: AppleIdApi }).AppleID;
}

let scriptPromise: Promise<void> | null = null;
function loadAppleId(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (appleId()) return resolve();
    // O script está em index.html com `async defer`; se ainda não terminou de
    // carregar, `document.querySelector` acha a tag e só esperamos o onload em
    // vez de injetar uma segunda cópia.
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${APPLE_SRC}"]`);
    const alvo = existente ?? document.createElement("script");
    if (!existente) {
      alvo.src = APPLE_SRC;
      alvo.async = true;
      alvo.defer = true;
      document.head.appendChild(alvo);
    }
    alvo.addEventListener("load", () => resolve());
    alvo.addEventListener("error", () => reject(new Error("Falha ao carregar a Apple")));
  });
  return scriptPromise;
}

interface Props {
  onCredential: (identityToken: string, userData?: { name?: string; email?: string }) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
}

const ROTULO: Record<NonNullable<Props["text"]>, string> = {
  signin_with: "Entrar com a Apple",
  signup_with: "Cadastrar com a Apple",
  continue_with: "Continuar com a Apple",
};

export function AppleSignInButton({ onCredential, text = "continue_with" }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const native = isNativeApp();

  // Na web sem Services ID configurado não há como iniciar o fluxo — melhor não
  // mostrar um botão que sempre falha. No app empacotado o fluxo nativo se
  // identifica pelo bundle ID e não depende dessa env.
  if (!native && !clientId()) return null;

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const credencial = native ? await entrarNativo() : await entrarNaWeb();
      if (credencial) {
        onCredential(credencial.identityToken, {
          name: credencial.name,
          email: credencial.email,
        });
      }
      // Sem credencial = usuário cancelou. Silêncio é a resposta certa.
    } catch {
      setError("Não foi possível entrar com a Apple. Use seu e-mail e senha.");
    } finally {
      setBusy(false);
    }
  }

  async function entrarNativo() {
    return signInWithAppleNative();
  }

  async function entrarNaWeb() {
    await loadAppleId();
    const api = appleId();
    if (!api) throw new Error("Apple indisponível");

    api.auth.init({
      clientId: clientId(),
      scope: "name email",
      redirectURI: redirectUri(),
      usePopup: true,
    });

    const resposta = await api.auth.signIn();
    const identityToken = resposta?.authorization?.id_token;
    if (!identityToken) return null;

    const nome = [resposta.user?.name?.firstName, resposta.user?.name?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      identityToken,
      name: nome || undefined,
      email: resposta.user?.email,
    };
  }

  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "center" }}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        style={{
          minHeight: 44,
          width: "100%",
          maxWidth: 320,
          padding: "0 16px",
          borderRadius: 8,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--color-text)",
          fontSize: 14,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <AppleMark />
        {busy ? "Abrindo…" : ROTULO[text]}
      </button>
      {error && (
        <span style={{ fontSize: 12, color: "var(--color-danger)", textAlign: "center" }}>
          {error}
        </span>
      )}
    </div>
  );
}

function AppleMark() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M16.365 1.43c0 1.14-.42 2.2-1.26 3.02-.99.99-2.13 1.56-3.36 1.47-.03-1.11.45-2.24 1.26-3.05.9-.9 2.19-1.5 3.36-1.44zM20.4 17.16c-.51 1.17-.75 1.68-1.41 2.7-.9 1.44-2.19 3.24-3.78 3.24-1.41.03-1.77-.93-3.69-.93s-2.31.93-3.72.96c-1.59.06-2.79-1.56-3.72-3-2.55-3.99-2.82-8.67-1.23-11.16 1.11-1.77 2.88-2.82 4.53-2.82 1.68 0 2.73.93 4.11.93 1.35 0 2.16-.93 4.11-.93 1.47 0 3.03.81 4.14 2.19-3.63 2.01-3.03 7.23.66 8.82z" />
    </svg>
  );
}
