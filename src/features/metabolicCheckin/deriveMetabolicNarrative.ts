import type { MetabolicCheckinRecord } from './types';
import type { WorkoutStats } from '../../services/workoutSessionApi';
import { windowSignal, loadDirection } from './metabolicSignals';

// Hero interpretativo (Fase 3) — cruza peso × carga (× cintura) em linguagem
// segura e acionável. Heurística TS pura: sem IA, sem latência, determinística.
// NUNCA diagnóstico clínico: vitais e tendências viram observação educativa.

export interface MetabolicNarrative {
  tone: 'positive' | 'neutral' | 'attention';
  headline: string;
  body: string;
  /** Próximo passo sugerido; quando presente, o card mostra um CTA de registro. */
  nextAction: string | null;
}

const HEADLINE = 'Como seu corpo está respondendo';

export function deriveMetabolicNarrative(input: {
  records: MetabolicCheckinRecord[];
  stats: WorkoutStats | null;
}): MetabolicNarrative | null {
  const weight = windowSignal(input.records, 'weightKg', 0.6, 5);
  const waist = windowSignal(input.records, 'waistCm', 0.6, 14);
  const load = loadDirection(input.stats);

  // Sem nenhum sinal cruzável: a timeline já orienta o primeiro registro.
  if (!weight && !load) return null;

  // --- Peso × carga (ambos disponíveis) ---
  if (weight && load) {
    if (weight.direction === 'stable' && load === 'up') {
      return {
        tone: 'positive',
        headline: HEADLINE,
        body: 'Seu peso está estável e sua carga vem subindo — sinal de evolução de performance sem ganho de peso relevante.',
        nextAction: waist ? null : 'Registre suas medidas para confirmar recomposição.',
      };
    }
    if (weight.direction === 'down' && (load === 'up' || load === 'stable')) {
      return {
        tone: 'positive',
        headline: HEADLINE,
        body: 'Você está mais leve e mantendo a carga nos treinos. Bom sinal: perda de peso preservando força.',
        nextAction: null,
      };
    }
    if (weight.direction === 'stable' && waist?.direction === 'down') {
      return {
        tone: 'positive',
        headline: HEADLINE,
        body: 'Peso estável e cintura reduzindo — um padrão típico de recomposição corporal.',
        nextAction: null,
      };
    }
    if (weight.direction === 'up' && load === 'up') {
      return {
        tone: 'neutral',
        headline: HEADLINE,
        body: 'Peso e carga subindo juntos — pode indicar ganho de massa com mais força. Suas medidas ajudam a confirmar.',
        nextAction: waist ? null : 'Adicione medidas para diferenciar massa de retenção.',
      };
    }
    if (weight.direction === 'down' && load === 'down') {
      return {
        tone: 'attention',
        headline: HEADLINE,
        body: 'Peso e carga estão caindo juntos. Vale cuidar da recuperação e da alimentação para não perder força pelo caminho.',
        nextAction: null,
      };
    }
    if (weight.direction === 'up' && (load === 'down' || load === 'stable')) {
      return {
        tone: 'attention',
        headline: HEADLINE,
        body: 'Seu peso subiu enquanto a carga não acompanhou. Pode ser uma fase de menor recuperação — observe sono e rotina.',
        nextAction: null,
      };
    }
    return {
      tone: 'neutral',
      headline: HEADLINE,
      body: 'Peso e carga estáveis no período. Consistência é uma boa base — siga registrando para captar a próxima virada.',
      nextAction: null,
    };
  }

  // --- Só carga ---
  if (load && !weight) {
    if (load === 'up') {
      return {
        tone: 'positive',
        headline: HEADLINE,
        body: 'Sua carga vem subindo nos treinos. Registre seu peso para a gente ler a evolução completa do seu corpo.',
        nextAction: 'Registre seu peso para cruzar com a carga.',
      };
    }
    return {
      tone: 'neutral',
      headline: HEADLINE,
      body: 'Você está treinando com consistência. Registre seu peso para acompanhar como o corpo responde.',
      nextAction: 'Registre seu peso.',
    };
  }

  // --- Só peso ---
  if (weight) {
    const trend = weight.direction === 'stable' ? 'estável' : weight.direction === 'down' ? 'em queda' : 'em alta';
    return {
      tone: 'neutral',
      headline: HEADLINE,
      body: `Seu peso está ${trend} nos últimos ${weight.days} dias. Registre a carga dos treinos para cruzarmos peso e performance.`,
      nextAction: 'Informe a carga ao concluir um treino.',
    };
  }

  return null;
}
