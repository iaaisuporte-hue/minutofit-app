import { useState } from 'react';
import type { PostWorkoutCheckin, PostWorkoutCheckinData } from '../engine/sportConfig.types';
import { submitPostWorkoutCheckin } from '../services/sportApi';

interface UsePostWorkoutCheckinReturn {
  submit: (data: PostWorkoutCheckinData) => Promise<PostWorkoutCheckin>;
  loading: boolean;
  error: string | null;
}

export function usePostWorkoutCheckin(): UsePostWorkoutCheckinReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(data: PostWorkoutCheckinData): Promise<PostWorkoutCheckin> {
    setLoading(true);
    setError(null);
    try {
      return await submitPostWorkoutCheckin(data);
    } catch (err: any) {
      const msg = err.message ?? 'Erro ao salvar check-in pós-treino';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return { submit, loading, error };
}
