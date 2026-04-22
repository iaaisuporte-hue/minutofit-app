import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { getMyFeatures } from "../services/featureApi";
import { mapCanonicalPlanToLabel, normalizeToCanonicalPlanName } from "../utils/planNormalization";

type FeatureFlagsState = {
  loading: boolean;
  planName: string | null;
  features: Record<string, boolean>;
  hasFeature: (key: string) => boolean;
  refresh: () => Promise<void>;
};

const FeatureFlagsContext = createContext<FeatureFlagsState | null>(null);

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [loading, setLoading] = useState(false);
  const [planName, setPlanName] = useState<string | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({});

  async function refresh() {
    if (!auth.isAuthenticated) {
      setPlanName(null);
      setFeatures({});
      return;
    }
    setLoading(true);
    try {
      const data = await getMyFeatures();
      const canonical = mapCanonicalPlanToLabel(normalizeToCanonicalPlanName(data.plan?.name || null));
      setPlanName(canonical);
      setFeatures(data.features || {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [auth.isAuthenticated, auth.user?.id]);

  const value = useMemo<FeatureFlagsState>(
    () => ({
      loading,
      planName,
      features,
      hasFeature: (key: string) => Boolean(features[key]),
      refresh,
    }),
    [loading, planName, features]
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error("useFeatureFlags must be used within FeatureFlagsProvider");
  return ctx;
}

