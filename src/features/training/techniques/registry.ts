import type { TechniqueDefinition, TechniqueType, TechniqueConfig } from './technique.types';

export const TECHNIQUE_REGISTRY: Record<Exclude<TechniqueType, 'none'>, TechniqueDefinition> = {
  drop_set: {
    type: 'drop_set',
    label: 'Drop Set',
    tagline: 'Eleva demanda metabólica sem volume extra',
    maasNote: 'Indicado em sessões de alta energia e boa recuperação',
    instructions: [
      'Execute as reps planejadas até quase-falha',
      'Reduza ~30% da carga sem descanso',
      'Continue até quase-falha novamente',
      'Descanse normalmente antes da próxima série',
    ],
    contraindications: [
      'Iniciantes sem técnica consolidada',
      'Sono ruim na noite anterior',
      'Score metabólico em queda recente',
    ],
    params: [
      { key: 'drops', label: 'Quedas', suffix: 'x', min: 1, max: 3, step: 1, defaultValue: 1 },
      { key: 'dropPercent', label: 'Redução', suffix: '%', min: 10, max: 50, step: 5, defaultValue: 30 },
    ],
    minExperienceLevel: 'intermediate',
  },
  rest_pause: {
    type: 'rest_pause',
    label: 'Rest-Pause',
    tagline: 'Esgota fibras com curtos intervalos de respiração',
    maasNote: 'Útil para densidade quando o tempo está curto',
    instructions: [
      'Execute as reps planejadas até quase-falha',
      'Descanse 15 segundos respirando profundo',
      'Continue até quase-falha novamente',
      'Repita conforme a configuração de mini-séries',
    ],
    contraindications: [
      'Cardio com frequência cardíaca elevada',
      'Articulação dolorida no movimento',
    ],
    params: [
      { key: 'pauseSeconds', label: 'Pausa', suffix: 's', min: 10, max: 30, step: 5, defaultValue: 15 },
      { key: 'miniSets', label: 'Mini-séries', suffix: 'x', min: 1, max: 4, step: 1, defaultValue: 2 },
    ],
    minExperienceLevel: 'intermediate',
  },
  bi_set: {
    type: 'bi_set',
    label: 'Bi-Set',
    tagline: 'Dois exercícios em sequência sem descanso',
    maasNote: 'Pareie movimentos complementares; descanse só após o par',
    instructions: [
      'Execute o primeiro exercício',
      'Vá direto ao segundo, sem descanso',
      'Descanse o intervalo planejado ao final do par',
      'Repita pelas séries combinadas',
    ],
    contraindications: [
      'Espaço/equipamento sem livre acesso aos dois movimentos',
    ],
    params: [],
  },
};

export function getTechniqueDefinition(type: TechniqueType): TechniqueDefinition | null {
  if (type === 'none') return null;
  return TECHNIQUE_REGISTRY[type] ?? null;
}

export function listTechniques(): TechniqueDefinition[] {
  return Object.values(TECHNIQUE_REGISTRY);
}

export function buildDefaultTechniqueConfig(type: TechniqueType): TechniqueConfig | undefined {
  if (type === 'none') return undefined;
  const def = TECHNIQUE_REGISTRY[type];
  if (!def) return undefined;
  const cfg: TechniqueConfig = { type };
  for (const p of def.params) {
    cfg[p.key] = p.defaultValue;
  }
  return cfg;
}
