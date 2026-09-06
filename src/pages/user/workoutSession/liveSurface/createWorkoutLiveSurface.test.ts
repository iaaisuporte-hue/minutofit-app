import { afterEach, describe, expect, it, vi } from "vitest";

const getPlatformMock = vi.fn();
vi.mock("../../../../lib/platform", () => ({ getPlatform: () => getPlatformMock() }));
vi.mock("@capacitor/core", () => ({ registerPlugin: () => ({}) }));

const { createWorkoutLiveSurface } = await import("./createWorkoutLiveSurface");
const { NativeWorkoutLiveSurface } = await import("./NativeWorkoutLiveSurface");
const { WebWorkoutLiveSurface } = await import("./WebWorkoutLiveSurface");

afterEach(() => vi.restoreAllMocks());

describe("createWorkoutLiveSurface — escolha por plataforma (P1D)", () => {
  it("Android recebe a superfície nativa", () => {
    getPlatformMock.mockReturnValue("android");
    expect(createWorkoutLiveSurface()).toBeInstanceOf(NativeWorkoutLiveSurface);
  });

  it("iOS e web caem no no-op — sem serviço nativo neste escopo", () => {
    getPlatformMock.mockReturnValue("ios");
    expect(createWorkoutLiveSurface()).toBeInstanceOf(WebWorkoutLiveSurface);
    getPlatformMock.mockReturnValue("web");
    expect(createWorkoutLiveSurface()).toBeInstanceOf(WebWorkoutLiveSurface);
  });
});
