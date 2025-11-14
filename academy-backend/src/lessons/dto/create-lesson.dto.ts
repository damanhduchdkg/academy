export class CreateLessonDto {
  course_id: string;
  title: string;
  type: 'video' | 'pdf' | 'slide' | 'text'; // khớp enum LessonType
  file_id?: string; // sẽ gắn sau khi upload file
  duration_seconds: number;
  order_index: number;
  is_mandatory: boolean;
}
