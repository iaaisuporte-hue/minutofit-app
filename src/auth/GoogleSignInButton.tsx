import { useEffect, useRef, useState } from "react";

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

export function GoogleSignInButton({ onCredential, text = "continue_with" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
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
          width: 320,
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

  if (!CLIENT_ID || failed) return null;
  return <div ref={ref} style={{ display: "flex", justifyContent: "center" }} />;
}
