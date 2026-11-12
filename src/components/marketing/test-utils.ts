import { vi } from "vitest";

/** Stubs matchMedia. Pass true so step players jump to their final state without timers. */
export function stubReducedMotion(reduced: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}
