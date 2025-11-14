export type LessonMeta = {
  id: string;
  title: string;
  is_mandatory: boolean;
  type: "video" | "pdf" | "slide" | "text";
  duration_seconds: number;
  youtube_url: string | null;
  video_url: string | null;
  pdf_url: string | null;
  slide_url: string | null;
  text_content: string | null;
};

export type LessonProgress = {
  pdfCompletedPages: number;
  pdfTotalPages: number;
  watched_seconds: number;
  completed: boolean;
  completed_at: string | null;
  last_position_sec: number;
  violated_at?: string | null;
  violation_reason?: string | null;
};
