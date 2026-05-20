import { useEffect, useState } from "react";
import { searchExercises, exerciseSummaryToCatalogEntry } from "../../../services/exercisesApi";
import { catalogEntryToExercise, type Exercise } from "./builderTypes";

export function useBuilderCatalog() {
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);
    void (async () => {
      try {
        const rows = await searchExercises({ limit: 200 });
        if (cancelled) return;
        setAllExercises(rows.map(exerciseSummaryToCatalogEntry).map(catalogEntryToExercise));
      } catch (e) {
        if (!cancelled) {
          setAllExercises([]);
          setCatalogError(e instanceof Error ? e.message : "Catálogo indisponível.");
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { allExercises, catalogLoading, catalogError, setCatalogError };
}
