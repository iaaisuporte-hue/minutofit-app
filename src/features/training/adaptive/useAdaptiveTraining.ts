import { useEffect, useReducer } from 'react';
import { fetchAdaptiveToday } from '../../../services/trainingAdaptiveApi';
import type { AdaptiveTodayResponse } from '../../../services/trainingAdaptiveApi';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: AdaptiveTodayResponse | null }
  | { status: 'error'; message: string };

type Action =
  | { type: 'fetch' }
  | { type: 'ok'; data: AdaptiveTodayResponse | null }
  | { type: 'fail'; message: string };

function reduce(_: State, action: Action): State {
  if (action.type === 'fetch') return { status: 'loading' };
  if (action.type === 'ok') return { status: 'done', data: action.data };
  return { status: 'error', message: action.message };
}

interface Result {
  data: AdaptiveTodayResponse | null;
  loading: boolean;
  error: string | null;
}

export function useAdaptiveTraining(enabled: boolean): Result {
  const [state, dispatch] = useReducer(reduce, { status: 'idle' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    dispatch({ type: 'fetch' });
    fetchAdaptiveToday()
      .then(data => { if (!cancelled) dispatch({ type: 'ok', data }); })
      .catch(err => { if (!cancelled) dispatch({ type: 'fail', message: err?.message ?? 'Erro ao carregar treino adaptado' }); });
    return () => { cancelled = true; };
  }, [enabled]);

  return {
    data: state.status === 'done' ? state.data : null,
    loading: state.status === 'loading',
    error: state.status === 'error' ? state.message : null,
  };
}
