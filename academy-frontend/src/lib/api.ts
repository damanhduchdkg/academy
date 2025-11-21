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

export const adminApi = {
  // Khoá học
  listCourses: (page: number, pageSize: number, token: string) =>
    request(
      `/admin/courses?page=${page}&pageSize=${pageSize}`,
      { method: "GET" },
      { token }
    ),

  toggleCourseStatus: (id: string, token: string) =>
    request(
      `/admin/courses/${id}/toggle-status`,
      { method: "POST" },
      { token }
    ),

  assignUserToCourse: (courseId: string, userId: string, token: string) =>
    request(
      `/admin/courses/${courseId}/assign-user`,
      {
        method: "POST",
        body: JSON.stringify({ userId }),
      },
      { token }
    ),

  unassignUserFromCourse: (courseId: string, userId: string, token: string) =>
    request(
      `/admin/courses/${courseId}/assign-user/${userId}`,
      { method: "DELETE" },
      { token }
    ),

  // Bài học
  listLessons: (
    token: string,
    params: {
      courseId?: string;
      page?: number;
      pageSize?: number;
      search?: string;
    } = {}
  ) => {
    const q = new URLSearchParams();
    if (params.courseId) q.set("courseId", params.courseId);
    if (params.page) q.set("page", String(params.page));
    if (params.pageSize) q.set("pageSize", String(params.pageSize));
    if (params.search) q.set("search", params.search);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return request(`/admin/lessons${qs}`, { method: "GET" }, { token });
  },

  createLesson: (token: string, body: any) =>
    request(
      `/admin/lessons`,
      { method: "POST", body: JSON.stringify(body) },
      { token }
    ),

  updateLesson: (token: string, lessonId: string, body: any) =>
    request(
      `/admin/lessons/${lessonId}`,
      { method: "PATCH", body: JSON.stringify(body) },
      { token }
    ),

  deleteLesson: (token: string, lessonId: string) =>
    request(`/admin/lessons/${lessonId}`, { method: "DELETE" }, { token }),

  attachFileToLesson: (token: string, lessonId: string, fileId: string) =>
    request(
      `/admin/lessons/${lessonId}/attach-file`,
      { method: "PATCH", body: JSON.stringify({ fileId }) },
      { token }
    ),

  detachFileFromLesson: (token: string, lessonId: string) =>
    request(
      `/admin/lessons/${lessonId}/attach-file`,
      { method: "DELETE" },
      { token }
    ),

  attachYoutubeToLesson: (
    token: string,
    lessonId: string,
    youtubeUrl: string
  ) =>
    request(
      `/admin/lessons/${lessonId}/youtube`,
      { method: "PATCH", body: JSON.stringify({ youtubeUrl }) },
      { token }
    ),

  detachYoutubeFromLesson: (token: string, lessonId: string) =>
    request(
      `/admin/lessons/${lessonId}/youtube`,
      { method: "DELETE" },
      { token }
    ),
};
