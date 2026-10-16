export function validarApiDeDistribuicao(
  raw: string | undefined,
): { ok: true; url: string } | { ok: false; motivo: string };

export function encontrarReferenciasLocais(texto: string): string[];
