import { useEffect, useRef, useState } from "react";
import { isNativeApp } from "../lib/platform";
import { isGoogleNativeConfigured, signInWithGoogleNative } from "./googleNativeAuth";

/**
 * Botão "Continuar com Google" via Google Identity Services (GIS) oficial.
 * Sem dependência npm — carrega o script CDN (mesmo padrão do MediaPipe).
 * O `credential` retornado é um ID token do Google, exatamente o que o
 * backend valida em POST /auth/oauth/google/callback.
 *
 * Renderiza nada se VITE_GOOGLE_CLIENT_ID não estiver configurado — assim
 * o login por e-mail continua funcionando sem Google em ambientes sem a env.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GSI_SRC = "https://accounts.google.com/gsi/client";

let scriptPromise: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar Google"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface Props {
  onCredential: (idToken: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
}

/**
 * Largura a pedir ao GIS, a partir do espaço realmente disponível.
 *
 * O Google NÃO renderiza o iframe com a largura pedida: ele soma ~20px de
 * chrome próprio (`margin: -2px -10px` no iframe). Pedindo 320 fixos, o
 * elemento sai com 340 — e num container de 296px (viewport de 360 menos os
 * paddings da página e do cartão) ele empurrava a tela inteira, produzindo
 * scroll horizontal no login e no cadastro a 320 e 360px, as duas larguras
 * Android mais comuns do Brasil.
 *
 * Descontar o chrome aqui é o que faz o botão caber. Os limites são os que o
 * GIS aceita (200–400); fora deles ele ignora o parâmetro e volta ao padrão,
 * que é justamente o caso que queríamos evitar.
 */
export function gsiWidth(containerWidth: number): number {
  const CHROME_DO_GOOGLE = 20;
  const disponivel = Number.isFinite(containerWidth) && containerWidth > 0
    ? Math.floor(containerWidth) - CHROME_DO_GOOGLE
    : 320 - CHROME_DO_GOOGLE;
  return Math.max(200, Math.min(400, disponivel));
}

export function GoogleSignInButton({ onCredential, text = "continue_with" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;
  const [failed, setFailed] = useState(false);
  const native = isNativeApp();

  useEffect(() => {
    // No app empacotado o GIS não roda (o Google bloqueia OAuth em WebView) —
    // quem cuida disso é o NativeGoogleButton abaixo.
    if (native || !CLIENT_ID) return;
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !ref.current) return;
        const g = (window as any).google;
        g.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp: { credential?: string }) => {
            if (resp.credential) cbRef.current(resp.credential);
          },
        });
        g.accounts.id.renderButton(ref.current, {
          theme: "outline",
          size: "large",
          width: gsiWidth(ref.current.clientWidth),
          text,
          shape: "rectangular",
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
    // Executa uma vez; o callback é lido via ref para não re-renderizar o botão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (native) return <NativeGoogleButton onCredential={onCredential} />;
  if (!CLIENT_ID || failed) return null;
  // `overflow: hidden` é cinto e suspensório: a largura calculada resolve o
  // caso de hoje, mas o iframe é de terceiro e pode mudar de tamanho sem aviso.
  // Contendo aqui, o pior caso vira um botão levemente recortado — e não a
  // página inteira rolando de lado.
  return (
    <div
      ref={ref}
      style={{ display: "flex", justifyContent: "center", maxWidth: "100%", overflow: "hidden" }}
    />
  );
}

/**
 * Botão próprio para o app empacotado: chama o seletor de conta do sistema e
 * entrega ao mesmo callback o `idToken` que o GIS entregaria na web.
 */
function NativeGoogleButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isGoogleNativeConfigured()) return null;

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const idToken = await signInWithGoogleNative();
      if (idToken) onCredential(idToken);
      // Sem token = usuário fechou o seletor. Silêncio é a resposta certa.
    } catch {
      setError("Não foi possível entrar com o Google. Use seu e-mail e senha.");
    } finally {
      setBusy(false);
    }
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
        }}
      >
        {busy ? "Abrindo…" : "Continuar com Google"}
      </button>
      {error && (
        <span style={{ fontSize: 12, color: "var(--color-danger)", textAlign: "center" }}>
          {error}
        </span>
      )}
    </div>
  );
}
