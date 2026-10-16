import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { isNativeApp } from "../lib/platform";
import { handleExternal } from "../lib/externalLink";

/** Páginas canônicas (site institucional) — as mesmas URLs informadas às lojas. */
const LEGAL_PUBLIC_URL = {
  termos: "https://s2core.com.br/termos",
  privacidade: "https://s2core.com.br/privacidade",
} as const;

type Documento = keyof typeof LEGAL_PUBLIC_URL;

/**
 * Link para Termos/Privacidade a partir de um formulário (cadastro).
 *
 * Na web: rota interna em nova aba — o formulário preenchido fica intacto.
 * No app empacotado esse mesmo `target="_blank"` numa rota interna não abre
 * NADA no iOS: o WKWebView entrega `capacitor://localhost/termos` ao
 * `UIApplication.open`, que não sabe o que fazer com ele. Lá abrimos a página
 * pública na folha do navegador do sistema (SFSafariViewController / Custom
 * Tab), que fecha de volta para o cadastro sem perder o que foi digitado.
 */
export function LegalLink({ doc, children }: { doc: Documento; children: ReactNode }) {
  if (isNativeApp()) {
    const url = LEGAL_PUBLIC_URL[doc];
    return (
      <a href={url} onClick={(e) => handleExternal(e, url)}>
        {children}
      </a>
    );
  }
  return (
    <Link to={`/${doc}`} target="_blank" rel="noopener noreferrer">
      {children}
    </Link>
  );
}
