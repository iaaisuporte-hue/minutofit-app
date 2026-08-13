export function normalizeCpf(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export function formatCpf(value: string) {
  const digits = normalizeCpf(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function isValidCpf(value: string) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const calculateDigit = (sliceLength: number) => {
    let sum = 0;
    for (let index = 0; index < sliceLength; index += 1) {
      sum += Number(cpf[index]) * (sliceLength + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
}

export function normalizePhone(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export function formatPhone(value: string) {
  const digits = normalizePhone(value).slice(0, 11);

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function isValidPhone(value: string) {
  const digits = normalizePhone(value);
  return digits.length === 10 || digits.length === 11;
}

export function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(String(value || "").trim());
}

/**
 * Idade mínima para criar conta.
 *
 * A plataforma trata dados sensíveis de saúde e não aceita menores — é a mesma
 * regra que o formulário de cadastro anuncia ("É necessário ter 18 anos ou
 * mais"). O servidor precisa revalidar quando a checagem entrar lá: validação
 * de cliente serve para o usuário não descobrir o problema só depois de enviar,
 * nunca como garantia.
 */
export const MINIMUM_AGE_YEARS = 18;

/**
 * Valida a data de nascimento do cadastro. Devolve a mensagem de erro a exibir
 * no campo, ou `null` quando está tudo certo.
 *
 * Espera o formato de `<input type="date">` (`YYYY-MM-DD`).
 */
export function getBirthDateError(value: string): string | null {
  if (!value) return "Informe sua data de nascimento.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Data de nascimento inválida.";

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  // `new Date(2026, 1, 30)` vira 2 de março em vez de falhar. Comparar de volta
  // é o que pega 31 de fevereiro e companhia.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return "Data de nascimento inválida.";
  }

  const today = new Date();
  if (date > today) return "Data de nascimento inválida.";

  let age = today.getFullYear() - year;
  const monthNow = today.getMonth() + 1;
  // Ainda não fez aniversário este ano: desconta um.
  if (monthNow < month || (monthNow === month && today.getDate() < day)) age -= 1;

  if (age < MINIMUM_AGE_YEARS) {
    return `É necessário ter ${MINIMUM_AGE_YEARS} anos ou mais para criar uma conta.`;
  }
  return null;
}

/** Mínimo 8 caracteres, 1 maiúscula (A–Z), 1 símbolo (não alfanumérico ASCII). */
export function getStrongPasswordError(password: string): string | null {
  const p = String(password || "");
  if (p.length < 8) {
    return "A senha deve ter no mínimo 8 caracteres.";
  }
  if (!/[A-Z]/.test(p)) {
    return "Inclua pelo menos uma letra maiúscula (A–Z).";
  }
  if (!/[^A-Za-z0-9]/.test(p)) {
    return "Inclua pelo menos um símbolo (ex.: ! @ # $ % & *).";
  }
  return null;
}

export function isStrongPassword(password: string): boolean {
  return getStrongPasswordError(password) === null;
}
