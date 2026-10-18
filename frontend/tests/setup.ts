import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom does not implement scrollIntoView — provide a no-op shim
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

import { useSyncExternalStore } from "react";

let mockParams = new URLSearchParams();
const listeners = new Set<() => void>();

function notifyParamsChange() {
  listeners.forEach((listener) => listener());
}

export const mockRouter = {
  push: vi.fn((url: string) => {
    const queryIdx = url.indexOf("?");
    mockParams = new URLSearchParams(queryIdx >= 0 ? url.slice(queryIdx) : "");
    notifyParamsChange();
  }),
  replace: vi.fn((url: string) => {
    const queryIdx = url.indexOf("?");
    mockParams = new URLSearchParams(queryIdx >= 0 ? url.slice(queryIdx) : "");
    notifyParamsChange();
  }),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

export function setTestSearchParams(paramsString: string) {
  mockParams = new URLSearchParams(paramsString);
  notifyParamsChange();
}

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => {
    return useSyncExternalStore(
      (notify) => {
        listeners.add(notify);
        return () => {
          listeners.delete(notify);
        };
      },
      () => mockParams,
      () => mockParams
    );
  },
  usePathname: () => "/",
}));

afterEach(() => {
  cleanup();
  mockParams = new URLSearchParams();
  listeners.clear();
  vi.clearAllMocks();
});
