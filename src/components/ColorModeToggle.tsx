import { useEffect, useState } from "react";

const STORAGE_KEY = "minutofit_color_mode";
const DALTONIC = "daltonic";
const DEFAULT = "default";

type ColorMode = typeof DALTONIC | typeof DEFAULT;

function readStoredMode(): ColorMode {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === DALTONIC ? DALTONIC : DEFAULT;
}

function applyMode(mode: ColorMode) {
  const root = document.documentElement;
  root.setAttribute("data-color-mode", mode);
}

export default function ColorModeToggle() {
  const [mode, setMode] = useState<ColorMode>(DEFAULT);

  useEffect(() => {
    const stored = readStoredMode();
    setMode(stored);
    applyMode(stored);
  }, []);

  function toggleMode() {
    const nextMode: ColorMode = mode === DALTONIC ? DEFAULT : DALTONIC;
    setMode(nextMode);
    localStorage.setItem(STORAGE_KEY, nextMode);
    applyMode(nextMode);
  }

  const enabled = mode === DALTONIC;

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-pressed={enabled}
      aria-label={enabled ? "Desativar modo daltônico" : "Ativar modo daltônico"}
      style={{
        position: "fixed",
        right: 14,
        bottom: 14,
        zIndex: 2000,
        borderRadius: 999,
        border: enabled ? "1px solid rgba(255,200,87,.65)" : "1px solid rgba(124,255,107,.28)",
        background: enabled ? "rgba(27,47,75,.95)" : "rgba(15,24,20,.95)",
        color: "#FFFFFF",
        padding: "10px 14px",
        fontWeight: 900,
        fontSize: 12,
        cursor: "pointer",
        boxShadow: "0 10px 24px rgba(0,0,0,.35)",
      }}
    >
      {enabled ? "Modo daltônico: ligado" : "Modo daltônico: desligado"}
    </button>
  );
}
