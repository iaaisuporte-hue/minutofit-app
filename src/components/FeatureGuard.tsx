import React from "react";
import { useFeatureFlags } from "../auth/FeatureFlagsContext";

export default function FeatureGuard({
  featureKey,
  mode = "hide",
  children,
  fallbackText,
}: {
  featureKey: string;
  mode?: "hide" | "block";
  children: React.ReactNode;
  fallbackText?: string;
}) {
  const { hasFeature, planName } = useFeatureFlags();
  const enabled = hasFeature(featureKey);
  if (enabled) return <>{children}</>;
  if (mode === "hide") return null;

  return (
    <div
      style={{
        border: "1px solid rgba(34,197,94,.24)",
        borderRadius: 14,
        padding: 14,
        background: "rgba(34,197,94,.08)",
        color: "#fff",
      }}
    >
      {fallbackText || `Disponivel em um plano superior ao ${planName ?? "atual"}.`}
    </div>
  );
}

