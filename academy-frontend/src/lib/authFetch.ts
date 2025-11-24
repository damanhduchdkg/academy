// src/lib/authFetch.ts
const API = process.env.NEXT_PUBLIC_API ?? "http://localhost:3000";

export type AuthFetchOptions = RequestInit & {
  timeoutMs?: number;
  retries?: number;
};

export async function authFetch(path: string, opts: AuthFetchOptions = {}) {
  const url = path.startsWith("http") ? path : `${API}${path}`;

  // Tách riêng phần option "mở rộng" ra khỏi RequestInit để không truyền vào fetch
  const { timeoutMs = 12000, retries = 1, ...fetchOpts } = opts;

  const token =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  async function once(attempt: number): Promise<any> {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const headers: HeadersInit = {
        ...(fetchOpts.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const method = (fetchOpts.method || "GET").toUpperCase();

      // Kiểm tra body có phải FormData không
      const isFormData =
        typeof FormData !== "undefined" && fetchOpts.body instanceof FormData;

      // Nếu không phải GET, không phải FormData và chưa có Content-Type
      // thì tự set application/json
      const hasContentType =
        (headers as any)["Content-Type"] || (headers as any)["content-type"];

      if (!hasContentType && method !== "GET" && !isFormData) {
        (headers as any)["Content-Type"] = "application/json";

        if (
          fetchOpts.body &&
          typeof fetchOpts.body === "object" &&
          !(fetchOpts.body instanceof Blob)
        ) {
          fetchOpts.body = JSON.stringify(fetchOpts.body) as any;
        }
      }

      const res = await fetch(url, {
        ...fetchOpts,
        signal: ctrl.signal,
        headers,
      });

      clearTimeout(id);

      const ct = res.headers.get("content-type") || "";

      if (!res.ok) {
        const body = ct.includes("application/json")
          ? await res.json().catch(() => ({}))
          : await res.text().catch(() => "");

        const msg =
          (body && (body.message || body.error)) ||
          `HTTP ${res.status}: ${res.statusText}`;

        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      if (ct.includes("application/json")) {
        return res.json();
      }

      // Nếu backend trả text/… thì trả thẳng text
      const txt = await res.text();
      return txt;
    } catch (e: any) {
      clearTimeout(id);
      if (e?.name === "AbortError" && attempt < retries) {
        return once(attempt + 1);
      }
      throw e;
    }
  }

  return once(0);
}
