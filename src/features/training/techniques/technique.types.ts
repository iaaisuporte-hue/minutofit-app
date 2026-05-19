export type TechniqueType =
  | 'none'
  | 'drop_set'
  | 'rest_pause'
  | 'bi_set';
  // futuro: 'superset' | 'cluster' | 'myo_reps' | 'giant_set' | 'pre_exhaustion' | 'fst7' | 'controlled_tempo'

export type TechniqueConfig = {
  type: TechniqueType;
  drops?: number;
  dropPercent?: number;
  pauseSeconds?: number;
  miniSets?: number;
  biSetGroupId?: string;
};

export type TechniqueParamKey =
  | 'drops'
  | 'dropPercent'
  | 'pauseSeconds'
  | 'miniSets';

export type TechniqueParamDef = {
  key: TechniqueParamKey;
  label: string;
  suffix?: string;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
};

export type TechniqueDefinition = {
  type: TechniqueType;
  label: string;
  tagline: string;
  maasNote: string;
  instructions: string[];
  contraindications: string[];
  params: TechniqueParamDef[];
  compatibleEquipment?: string[];
  minExperienceLevel?: 'intermediate' | 'advanced';
};

export type TechniqueReadinessLevel = 'green' | 'yellow' | 'red';

export type TechniqueReadiness = {
  level: TechniqueReadinessLevel;
  message: string | null;
  signals: string[];
};
