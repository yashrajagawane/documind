import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  apiFetch,
  apiUploadWithProgress,
  registerAuthCallbacks,
  unregisterAuthCallbacks,
} from "./api";
import type { AuthResponse } from "./types";

describe("api client auth and refresh coordination", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    unregisterAuthCallbacks();
  });

  it("attaches bearer token to requests when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
    });
    global.fetch = mockFetch;

    const result = await apiFetch<{ status: string }>("/documents", {}, "valid-token-123");

    expect(result).toEqual({ status: "ok" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/documents"),
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
    const sentHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(sentHeaders.get("Authorization")).toBe("Bearer valid-token-123");
  });

  it("intercepts 401, refreshes token, and retries the request with new token", async () => {
    const mockAuthResponse: AuthResponse = {
      user: { id: "user-1", email: "test@example.com" },
      access_token: "refreshed-token-999",
      token_type: "bearer",
    };

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/auth/refresh")) {
        return {
          ok: true,
          status: 200,
          json: async () => mockAuthResponse,
        };
      }
      if (url.includes("/documents")) {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 401,
            json: async () => ({
              success: false,
              error: { code: "UNAUTHORIZED", message: "Token expired" },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: "doc-1", original_name: "test.pdf" }],
        };
      }
      return { ok: false, status: 404 };
    });
    global.fetch = mockFetch;

    const onTokenRefreshed = vi.fn();
    const onSessionExpired = vi.fn();
    registerAuthCallbacks({ onTokenRefreshed, onSessionExpired });

    const data = await apiFetch<Array<{ id: string }>>("/documents", {}, "expired-token");

    expect(data).toEqual([{ id: "doc-1", original_name: "test.pdf" }]);
    expect(onTokenRefreshed).toHaveBeenCalledWith(mockAuthResponse);
    expect(onSessionExpired).not.toHaveBeenCalled();

    // Verify refresh was called
    const refreshCall = mockFetch.mock.calls.find((c) => c[0].includes("/auth/refresh"));
    expect(refreshCall).toBeDefined();

    // Verify retry used the new token
    const lastDocumentsCall = mockFetch.mock.calls
      .filter((c) => c[0].includes("/documents"))
      .pop();
    const headers = lastDocumentsCall?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer refreshed-token-999");
  });

  it("co-ordinates multiple parallel 401 requests to fire only ONE refresh request", async () => {
    const mockAuthResponse: AuthResponse = {
      user: { id: "user-1", email: "test@example.com" },
      access_token: "shared-refreshed-token",
      token_type: "bearer",
    };

    let refreshCallCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/auth/refresh")) {
        refreshCallCount++;
        // Add artificial delay to test concurrency
        await new Promise((resolve) => setTimeout(resolve, 15));
        return {
          ok: true,
          status: 200,
          json: async () => mockAuthResponse,
        };
      }
      // Return 401 on first call, 200 on retry
      const authHeader = (init?.headers as Headers)?.get("Authorization");
      if (authHeader === "Bearer shared-refreshed-token") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, url }),
        };
      }
      return {
        ok: false,
        status: 401,
        json: async () => ({ success: false, error: { code: "UNAUTHORIZED", message: "Expired" } }),
      };
    });
    global.fetch = mockFetch;

    // Launch two parallel requests that both fail with 401
    const [res1, res2] = await Promise.all([
      apiFetch("/documents", {}, "stale-1"),
      apiFetch("/users/me", {}, "stale-2"),
    ]);

    expect(res1).toBeDefined();
    expect(res2).toBeDefined();
    // CRITICAL: Only one single refresh call must have occurred despite 2 concurrent 401s
    expect(refreshCallCount).toBe(1);
  });

  it("notifies session expired and throws when refresh fails", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/auth/refresh")) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ success: false, error: { message: "Invalid session" } }),
        };
      }
      return {
        ok: false,
        status: 401,
        json: async () => ({ success: false, error: { message: "Authentication required." } }),
      };
    });
    global.fetch = mockFetch;

    const onSessionExpired = vi.fn();
    registerAuthCallbacks({ onTokenRefreshed: vi.fn(), onSessionExpired });

    await expect(apiFetch("/documents", {}, "invalid-token")).rejects.toThrow(
      "Authentication required."
    );
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it("does not attempt refresh on auth routes like /auth/login", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: { message: "Invalid email or password." } }),
    });
    global.fetch = mockFetch;

    await expect(
      apiFetch("/auth/login", { method: "POST", body: "{}" })
    ).rejects.toThrow("Invalid email or password.");

    const refreshCall = mockFetch.mock.calls.find((c) => c[0].includes("/auth/refresh"));
    expect(refreshCall).toBeUndefined();
  });

  it("dispatches progress events and resolves with response payload in apiUploadWithProgress", async () => {
    const originalXHR = global.XMLHttpRequest;
    const mockUpload = { onprogress: null as ((e: ProgressEvent) => void) | null };
    const mockXHR = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(function (this: {
        status: number;
        responseText: string;
        onload: () => void;
      }) {
        if (mockUpload.onprogress) {
          mockUpload.onprogress({
            lengthComputable: true,
            loaded: 50,
            total: 100,
          } as ProgressEvent);
        }
        this.status = 200;
        this.responseText = JSON.stringify({ id: "doc-1", name: "uploaded.pdf" });
        this.onload();
      }),
      upload: mockUpload,
      status: 200,
      responseText: "",
      onload: vi.fn(),
      onerror: vi.fn(),
      withCredentials: false,
    };
    // @ts-expect-error test mock
    global.XMLHttpRequest = vi.fn(() => mockXHR);

    try {
      const onProgress = vi.fn();
      const formData = new FormData();
      formData.append("file", new File(["test"], "uploaded.pdf"));

      const res = await apiUploadWithProgress<{ id: string; name: string }>(
        "/documents",
        formData,
        {
          accessToken: "valid-token",
          idempotencyKey: "idem-123",
          onProgress,
        }
      );

      expect(res).toEqual({ id: "doc-1", name: "uploaded.pdf" });
      expect(mockXHR.open).toHaveBeenCalledWith("POST", expect.stringContaining("/documents"));
      expect(mockXHR.setRequestHeader).toHaveBeenCalledWith("Authorization", "Bearer valid-token");
      expect(mockXHR.setRequestHeader).toHaveBeenCalledWith("Idempotency-Key", "idem-123");
      expect(onProgress).toHaveBeenCalledWith({ loaded: 50, total: 100, percent: 50 });
    } finally {
      global.XMLHttpRequest = originalXHR;
    }
  });

  it("rejects with backend error message on non-200 status in apiUploadWithProgress", async () => {
    const originalXHR = global.XMLHttpRequest;
    const mockXHR = {
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      send: vi.fn(function (this: {
        status: number;
        responseText: string;
        onload: () => void;
      }) {
        this.status = 400;
        this.responseText = JSON.stringify({
          success: false,
          error: { code: "BAD_REQUEST", message: "File is corrupted." },
        });
        this.onload();
      }),
      upload: {},
      status: 400,
      responseText: "",
      onload: vi.fn(),
      onerror: vi.fn(),
      withCredentials: false,
    };
    // @ts-expect-error test mock
    global.XMLHttpRequest = vi.fn(() => mockXHR);

    try {
      const formData = new FormData();
      await expect(
        apiUploadWithProgress("/documents", formData)
      ).rejects.toThrow("File is corrupted.");
    } finally {
      global.XMLHttpRequest = originalXHR;
    }
  });
});
