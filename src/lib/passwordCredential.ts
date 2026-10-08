/**
 * Credential Management API — pede ao browser/WebView pra oferecer "salvar
 * senha" depois de um login ou cadastro bem-sucedido.
 *
 * Por que isto é necessário e não só os `autoComplete="current-password"` nos
 * inputs: o form é enviado via `fetch` (SPA, sem navegação de página), e é
 * exatamente a navegação pós-submit que o autofill do Chrome/WebView usa como
 * sinal heurístico de "login deu certo, oferece salvar". Sem navegação, esse
 * heurístico falha com frequência — principalmente dentro da WebView do
 * Capacitor. Chamar `navigator.credentials.store()` explicitamente contorna a
 * heurística e funciona tanto na web quanto no app empacotado (Chrome
 * WebView implementa a mesma API).
 */
export async function offerToSaveCredential(email: string, password: string): Promise<void> {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  const PasswordCredentialCtor = (window as unknown as { PasswordCredential?: new (data: {
    id: string;
    password: string;
    name?: string;
  }) => Credential }).PasswordCredential;
  if (!PasswordCredentialCtor || !("credentials" in navigator)) return;

  try {
    const credential = new PasswordCredentialCtor({ id: email, password, name: email });
    await navigator.credentials.store(credential);
  } catch {
    // Sem suporte, prompt recusado pelo usuário, ou qualquer outra falha — o
    // login/cadastro já foi concluído antes desta chamada; ignorar.
  }
}
