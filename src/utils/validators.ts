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
