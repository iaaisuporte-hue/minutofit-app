import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineBanner } from "./OfflineBanner";

const lerVar = () => document.documentElement.style.getPropertyValue("--offline-banner-h");

describe("OfflineBanner — reserva de layout", () => {
  afterEach(() => vi.restoreAllMocks());

  it("publica a altura medida ao ficar offline e remove ao voltar", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 52 } as DOMRect);
    const { container } = render(<OfflineBanner />);
    expect(container.querySelector(".offline-banner")).toBeNull();
    expect(lerVar()).toBe("");

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(container.querySelector(".offline-banner")).not.toBeNull();
    expect(lerVar()).toBe("52px");
    expect(document.documentElement.classList.contains("is-offline")).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(lerVar()).toBe("");
    expect(document.documentElement.classList.contains("is-offline")).toBe(false);
  });
});
