// src/services/adminUsers.ts
import { authFetch } from "@/lib/authFetch";

export type AdminUserItem = {
  id: string;
  full_name: string;
  username: string;
  role: string;
  department: string | null;
  status: string;
  created_at?: string;
  last_login_at?: string | null;
};

export interface AdminUsersResponse {
  page: number;
  pageSize: number;
  total: number;
  data: AdminUserItem[];
}

export async function fetchAdminUsers(
  page = 1,
  pageSize = 20,
  search?: string
): Promise<AdminUsersResponse> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (search) params.set("search", search);

  const query = params.toString() ? `?${params.toString()}` : "";

  const raw = await authFetch(`/users/admin${query}`, {
    method: "GET",
  });

  // Nếu BE trả {data, page, pageSize, total}
  if (raw && Array.isArray(raw.data)) {
    return raw as AdminUsersResponse;
  }

  // Nếu BE trả mảng trần -> tự wrap
  if (Array.isArray(raw)) {
    const list = raw as AdminUserItem[];
    return {
      page,
      pageSize,
      total: list.length,
      data: list,
    };
  }

  // fallback
  return {
    page: raw.page ?? page,
    pageSize: raw.pageSize ?? pageSize,
    total: raw.total ?? raw.data?.length ?? 0,
    data: raw.data ?? [],
  } as AdminUsersResponse;
}
