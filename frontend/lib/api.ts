import type { AuthResponse } from "@/lib/types";

export type ApiError = {
  success: false;
  error: { code: string; message: string; request_id?: string };
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

// Coordinated single-flight refresh lock
let refreshPromise: Promise<string | null> | null = null;
let onTokenRefreshedCallback: ((auth: AuthResponse) => void) | null = null;
let onSessionExpiredCallback: (() => void) | null = null;

export function registerAuthCallbacks(callbacks: {
  onTokenRefreshed: (auth: AuthResponse) => void;
  onSessionExpired: () => void;
}) {
  onTokenRefreshedCallback = callbacks.onTokenRefreshed;
  onSessionExpiredCallback = callbacks.onSessionExpired;
}

export function unregisterAuthCallbacks() {
  onTokenRefreshedCallback = null;
  onSessionExpiredCallback = null;
}

async function coordinateTokenRefresh(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        onSessionExpiredCallback?.();
        return null;
      }

      const data = (await response.json()) as AuthResponse;
      onTokenRefreshedCallback?.(data);
      return data.access_token;
    } catch {
      onSessionExpiredCallback?.();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function isAuthRoute(path: string): boolean {
  return (
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/register") ||
    path.startsWith("/auth/refresh")
  );
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
  retryCount = 0,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers, credentials: "include" });

  if (response.status === 401 && !isAuthRoute(path) && retryCount === 0) {
    const newToken = await coordinateTokenRefresh();
    if (newToken) {
      return apiFetch<T>(path, options, newToken, retryCount + 1);
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error.message ?? "The request could not be completed.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiDownload(
  path: string,
  accessToken: string,
  retryCount = 0,
): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Accept: "application/octet-stream", Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });

  if (response.status === 401 && retryCount === 0) {
    const newToken = await coordinateTokenRefresh();
    if (newToken) {
      return apiDownload(path, newToken, retryCount + 1);
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error.message ?? "The download could not be completed.");
  }
  return response.blob();
}

export interface SSEEvent {
  event: string;
  data: string;
}

export async function* apiStreamSSE(
  path: string,
  body: unknown,
  accessToken?: string | null,
  retryCount = 0,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "text/event-stream");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "include",
    signal,
  });

  if (response.status === 401 && retryCount === 0) {
    const newToken = await coordinateTokenRefresh();
    if (newToken) {
      yield* apiStreamSSE(path, body, newToken, retryCount + 1, signal);
      return;
    }
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(errorBody?.error.message ?? "The stream request could not be completed.");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body is not readable.");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (err) {
      // AbortError is a clean cancellation — not a failure
      if (err instanceof DOMException && err.name === "AbortError") return;
      throw err;
    }
    const { done, value } = chunk;
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (!part.trim()) continue;
      const lines = part.split("\n");
      let eventType = "message";
      let dataText = "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataText = line.slice(5).trim();
        }
      }

      if (dataText) {
        yield { event: eventType, data: dataText };
      }
    }
  }

  if (buffer.trim()) {
    const lines = buffer.split("\n");
    let eventType = "message";
    let dataText = "";
    for (const line of lines) {
      if (line.startsWith("event:")) eventType = line.slice(6).trim();
      else if (line.startsWith("data:")) dataText = line.slice(5).trim();
    }
    if (dataText) yield { event: eventType, data: dataText };
  }
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

export interface UploadOptions {
  accessToken?: string | null;
  idempotencyKey?: string;
  onProgress?: UploadProgressCallback;
  retryCount?: number;
  signal?: AbortSignal;
}

export async function apiUploadWithProgress<T>(
  path: string,
  formData: FormData,
  options: UploadOptions = {},
): Promise<T> {
  const { accessToken, idempotencyKey, onProgress, retryCount = 0, signal } = options;

  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload aborted", "AbortError"));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBaseUrl}${path}`);
    xhr.withCredentials = true;

    xhr.setRequestHeader("Accept", "application/json");
    if (accessToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    }
    if (idempotencyKey) {
      xhr.setRequestHeader("Idempotency-Key", idempotencyKey);
    }

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event: ProgressEvent) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percent,
          });
        }
      };
    }

    let abortHandler: (() => void) | null = null;
    if (signal) {
      abortHandler = () => xhr.abort();
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    const cleanup = () => {
      if (signal && abortHandler) {
        signal.removeEventListener("abort", abortHandler);
      }
    };

    xhr.onload = async () => {
      cleanup();

      if (xhr.status === 401 && !isAuthRoute(path) && retryCount === 0) {
        const newToken = await coordinateTokenRefresh();
        if (newToken) {
          try {
            const retried = await apiUploadWithProgress<T>(path, formData, {
              ...options,
              accessToken: newToken,
              retryCount: retryCount + 1,
            });
            resolve(retried);
            return;
          } catch (retryErr) {
            reject(retryErr);
            return;
          }
        }
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        if (xhr.status === 204) {
          resolve(undefined as T);
          return;
        }
        try {
          const data = JSON.parse(xhr.responseText) as T;
          resolve(data);
        } catch {
          resolve(undefined as T);
        }
      } else {
        try {
          const body = JSON.parse(xhr.responseText) as ApiError;
          reject(new Error(body?.error?.message ?? "The request could not be completed."));
        } catch {
          reject(new Error("The request could not be completed."));
        }
      }
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error("Network error during file upload. Please check your connection."));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Upload aborted", "AbortError"));
    };

    xhr.send(formData);
  });
}
