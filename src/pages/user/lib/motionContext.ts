// ================================================================
// Motion Context — detects cheating, inactivity, device movement,
// and out-of-frame states. Pure functions + event handler.
// ================================================================

export type ContextSeverity = "info" | "warn" | "block";

export type ContextAssessment = {
  valid: boolean;
  reason?: string;
  severity?: ContextSeverity;
};

// ── Out-of-frame: <60% of key landmarks visible for 3+ seconds ─

export function assessOutOfFrame(
  visibilities: (number | null | undefined)[]
): boolean {
  const nums = visibilities.filter((v): v is number => typeof v === "number");
  if (!nums.length) return true;
  const goodFraction = nums.filter((v) => v > 0.5).length / nums.length;
  return goodFraction < 0.6;
}

// ── Inactivity: stddev < 3° across last 10 angle samples ─────

export function assessInactive(angleHistory: number[]): boolean {
  if (angleHistory.length < 10) return false;
  const recent = angleHistory.slice(-10);
  const mean = recent.reduce((s, v) => s + v, 0) / recent.length;
  const variance =
    recent.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / recent.length;
  return Math.sqrt(variance) < 3;
}

// ── Partial reps: last 3 reps < 70% of first rep amplitude ───

export function assessPartialReps(repAmplitudes: number[]): boolean {
  if (repAmplitudes.length < 4) return false;
  const base = repAmplitudes[0];
  if (base < 20) return false;
  return repAmplitudes.slice(-3).every((a) => a < base * 0.7);
}

// ── Device motion: module-level accumulator for event data ────

let _movingCount = 0;
let _lastResetMs = 0;

export function handleDeviceMotion(event: DeviceMotionEvent): void {
  const acc = event.accelerationIncludingGravity;
  if (!acc) return;
  const magnitude = Math.sqrt(
    (acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2
  );
  const now = Date.now();
  if (now - _lastResetMs > 2000) {
    _movingCount = 0;
    _lastResetMs = now;
  }
  // Gravity alone ≈ 9.8 m/s². Threshold 12 = gravity + ~2 m/s² lateral
  if (magnitude > 12) _movingCount++;
}

export function isDeviceMoving(): boolean {
  return _movingCount >= 4;
}

// ── Aggregated context assessment ────────────────────────────

export function assessContext(params: {
  outOfFrame: boolean;
  inactive: boolean;
  deviceMoving: boolean;
  partialReps: boolean;
}): ContextAssessment {
  if (params.deviceMoving) {
    return {
      valid: false,
      reason:
        "Dispositivo em movimento — posicione o celular em local estável antes de continuar.",
      severity: "block",
    };
  }

  if (params.outOfFrame) {
    return {
      valid: false,
      reason:
        "Saia do enquadramento — mostre o corpo inteiro na câmera para continuar.",
      severity: "warn",
    };
  }

  if (params.partialReps) {
    return {
      valid: true,
      reason:
        "Amplitude reduzindo nas últimas reps — possível sinal de fadiga.",
      severity: "info",
    };
  }

  if (params.inactive) {
    return {
      valid: true,
      reason:
        "Sem movimento detectado — inicie o exercício para começar a contar.",
      severity: "info",
    };
  }

  return { valid: true };
}
