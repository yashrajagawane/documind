export type ApiError = {
  success: false;
  error: { code: string; message: string; request_id?: string };
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers, credentials: "include" });
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
): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Accept: "application/octet-stream", Authorization: `Bearer ${accessToken}` },
    credentials: "include",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error.message ?? "The download could not be completed.");
  }
  return response.blob();
}
