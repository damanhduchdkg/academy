export type ApiOptions = { token?: string };

async function request<T = any>(
  path: string,
  init: RequestInit = {},
  opts: ApiOptions = {}
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE || "";
  const headers: Record<string, string> = {
    ...(init.method && init.method !== "GET"
      ? { "Content-Type": "application/json" }
      : {}),
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...(init.headers as any),
  };
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

/* Endpoints FE dùng */
export const api = {
  getLesson: (id: string, token: string) =>
    request(`/lessons/${id}`, { method: "GET" }, { token }),

  patchProgress: (
    id: string,
    body: { watchedSeconds: number; lastPositionSec: number },
    token: string
  ) =>
    request(
      `/lessons/${id}/progress`,
      { method: "PATCH", body: JSON.stringify(body) },
      { token }
    ),

  finalizeLesson: (
    id: string,
    body: { lastPositionSec: number },
    token: string
  ) =>
    request(
      `/lessons/${id}/finalize`,
      { method: "PATCH", body: JSON.stringify(body) },
      { token }
    ),

  markViolation: (
    id: string,
    body: { reason: "seek" | "rate" | "both"; reset: boolean; coverage?: any },
    token: string
  ) =>
    request(
      `/lessons/${id}/violation`,
      { method: "PATCH", body: JSON.stringify(body) },
      { token }
    ),
};
