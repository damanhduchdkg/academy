"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";

export type AuthUser = {
  id: string;
  full_name: string;
  role: string;
};

interface UseAuthGuardOptions {
  requiredRoles?: string[]; // ví dụ ['admin', 'manager']
  redirectTo?: string; // mặc định: '/login'
}

/**
 * Guard đơn giản:
 * - Đọc token từ localStorage
 * - Nếu không có -> đẩy về login
 * - Nếu có -> đọc currentUser từ localStorage
 *   + Nếu chưa có / nghi ngờ -> gọi /auth/me để xác thực lại
 */
export function useAuthGuard(options: UseAuthGuardOptions = {}) {
  const { requiredRoles, redirectTo = "/login" } = options;
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("accessToken")
          : null;

      if (!token) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
          router.replace(redirectTo);
        }
        return;
      }

      // 1. Thử lấy user từ localStorage
      let u: AuthUser | null = null;
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem("currentUser");
        if (raw) {
          try {
            u = JSON.parse(raw) as AuthUser;
          } catch {
            u = null;
          }
        }
      }

      // 2. Nếu chưa có user, gọi /auth/me để xác thực
      if (!u) {
        try {
          const me = await authFetch("/auth/me", { method: "GET" });
          u = {
            id: me.id,
            full_name: me.full_name,
            role: me.role,
          };
          if (typeof window !== "undefined") {
            window.localStorage.setItem("currentUser", JSON.stringify(u));
          }
        } catch (e) {
          // token hỏng / hết hạn
          if (!cancelled) {
            window.localStorage.removeItem("accessToken");
            window.localStorage.removeItem("currentUser");
            setUser(null);
            setLoading(false);
            router.replace(redirectTo);
          }
          return;
        }
      }

      // 3. Check role nếu có yêu cầu
      if (
        requiredRoles &&
        requiredRoles.length > 0 &&
        (!u || !requiredRoles.includes(u.role))
      ) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
          // user có login nhưng không đủ quyền → đẩy về trang học
          router.replace("/courses");
        }
        return;
      }

      if (!cancelled) {
        setUser(u);
        setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [requiredRoles, redirectTo, router]);

  return { user, loading };
}
