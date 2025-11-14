// /src/lib/authFetch.ts
const API = process.env.NEXT_PUBLIC_API ?? "http://localhost:3000";

type Options = RequestInit & { timeoutMs?: number; retries?: number };

export async function authFetch(path: string, opts: Options = {}) {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const timeoutMs = opts.timeoutMs ?? 12000;
  const retries = opts.retries ?? 1;

  const token =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  async function once(attempt: number) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...opts,
        signal: ctrl.signal,
        headers: {
          ...(opts.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(opts.method && opts.method !== "GET"
            ? { "Content-Type": "application/json" }
            : {}),
        },
        // quan trọng: để preflight đơn giản, chỉ gửi 2 header tiêu chuẩn
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

      if (ct.includes("application/json")) return res.json();
      // nếu BE trả HTML (lỗi proxy) -> ném lỗi rõ ràng
      const txt = await res.text();
      throw new Error(`Server trả về non-JSON: ${txt.slice(0, 120)}...`);
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
