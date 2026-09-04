import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dayKey } from '../../lib/appDay';
import { parseRemoteCondition, useDailyCondition } from './useDailyCondition';

const STORAGE_KEY = 'daily_condition_v1';

describe('parseRemoteCondition', () => {
  it('aceita a condição do servidor e normaliza os detalhes', () => {
    const c = parseRemoteCondition({
      date: '2026-09-04',
      feeling: 'tired',
      details: { sleptWell: false, inPain: true, stressed: false, nutritionLevel: 'poor' },
    });
    expect(c).toEqual({
      date: '2026-09-04',
      feeling: 'tired',
      details: { sleptWell: false, inPain: true, stressed: false, nutritionLevel: 'poor' },
    });
  });

  it('não inventa sinais opcionais que não foram respondidos', () => {
    const c = parseRemoteCondition({ date: '2026-09-04', feeling: 'normal', details: {} });
    expect(c?.details).toEqual({ sleptWell: false, inPain: false, stressed: false });
    expect(c?.details && 'hydrationOk' in c.details).toBe(false);
    expect(c?.details && 'mentalLoadLevel' in c.details).toBe(false);
  });

  it('devolve null para lixo em vez de quebrar a Home', () => {
    expect(parseRemoteCondition(null)).toBeNull();
    expect(parseRemoteCondition('x')).toBeNull();
    expect(parseRemoteCondition({ date: '2026-09-04' })).toBeNull();
    expect(parseRemoteCondition({ date: 1, feeling: 'tired' })).toBeNull();
    expect(parseRemoteCondition({ date: '2026-09-04', feeling: 'ótimo' })).toBeNull();
  });
});

describe('useDailyCondition — o servidor é a fonte da verdade (P0.1)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('sem storage local, a resposta já gravada no servidor evita repetir a pergunta', () => {
    // Cenário real do defeito: aparelho novo / dados do app limpos / reinstalação.
    const remoto = { date: dayKey(), feeling: 'energized', details: null };
    const { result } = renderHook(() => useDailyCondition(remoto));
    expect(result.current.condition?.feeling).toBe('energized');
  });

  it('espelha no storage para a resposta continuar à vista offline', () => {
    const remoto = { date: dayKey(), feeling: 'tired', details: null };
    renderHook(() => useDailyCondition(remoto));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toMatchObject({
      date: dayKey(),
      feeling: 'tired',
    });
  });

  it('ignora condição do servidor que não é de hoje', () => {
    const { result } = renderHook(() =>
      useDailyCondition({ date: '2020-01-01', feeling: 'tired', details: null }),
    );
    expect(result.current.condition).toBeNull();
  });

  it('servidor sem resposta NÃO apaga o que a pessoa respondeu offline', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: dayKey(), feeling: 'normal', details: null }),
    );
    const { result } = renderHook(() => useDailyCondition(null));
    expect(result.current.condition?.feeling).toBe('normal');
  });

  it('resposta do servidor prevalece sobre um local divergente (outro aparelho)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: dayKey(), feeling: 'normal', details: null }),
    );
    const { result } = renderHook(() =>
      useDailyCondition({ date: dayKey(), feeling: 'tired', details: null }),
    );
    expect(result.current.condition?.feeling).toBe('tired');
  });

  it('responder localmente continua funcionando antes de o servidor confirmar', () => {
    const { result } = renderHook(() => useDailyCondition(undefined));
    expect(result.current.condition).toBeNull();
    act(() => {
      result.current.setCondition('energized', { sleptWell: true, inPain: false, stressed: false });
    });
    expect(result.current.condition?.feeling).toBe('energized');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('energized');
  });
});
