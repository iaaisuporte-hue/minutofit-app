/**
 * Flags de produto do frontend (espelho de `backend/src/config/features.ts`).
 */

/**
 * Cobrança aluno↔profissional PELA plataforma. **Congelada na V1 por decisão
 * consciente** (ver CLAUDE.md): a plataforma cobra só o personal (SaaS Pro);
 * dinheiro personal↔aluno fica FORA da plataforma. Com isto desligado, a UI de
 * cobrança de aluno (ofertas pagas, painel financeiro, assinatura de aluno) fica
 * oculta — o backend também bloqueia as rotas que movem dinheiro. Reativar exige
 * decisão explícita (frontend + backend + termos jurídicos de marketplace).
 */
export const STUDENT_BILLING_ENABLED =
  import.meta.env.VITE_STUDENT_BILLING_ENABLED === "true";
