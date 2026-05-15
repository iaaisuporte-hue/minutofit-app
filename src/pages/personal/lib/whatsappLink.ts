/**
 * Utilitários para deep-link WhatsApp (wa.me).
 *
 * Regras:
 * - Nunca disparar automaticamente — chamado apenas por ação explícita do personal.
 * - Não usar Cloud API, bulk, templates automáticos ou qualquer automação.
 * - O envio final SEMPRE é humano (o personal revisa no WhatsApp antes de enviar).
 */

/**
 * Normaliza um número brasileiro para o formato E.164 sem o `+`.
 * Aceita 10 dígitos (DDD + 8 dígitos) ou 11 dígitos (DDD + 9 dígitos).
 * Retorna null para formatos inválidos.
 */
export function normalizePhoneToBRE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // Remove +55 ou 55 prefix se já presente
  const stripped = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  if (stripped.length < 10 || stripped.length > 11) return null;
  return `55${stripped}`;
}

/**
 * Constrói o deep-link wa.me com o número e o texto pré-preenchido.
 * Retorna null quando o telefone for inválido.
 */
export function buildWhatsappLink(phone: string | null | undefined, message: string): string | null {
  const e164 = normalizePhoneToBRE164(phone);
  if (!e164) return null;
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

/**
 * Abre o WhatsApp (Web ou App via deep-link) em nova aba.
 * Retorna `true` se o link foi aberto, `false` se o telefone era inválido.
 */
export function openWhatsappCompose(phone: string | null | undefined, message: string): boolean {
  const link = buildWhatsappLink(phone, message);
  if (!link) return false;
  window.open(link, "_blank", "noopener,noreferrer");
  return true;
}
