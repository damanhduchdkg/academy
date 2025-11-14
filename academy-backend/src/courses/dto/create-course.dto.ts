export class CreateCourseDto {
  title: string;
  description: string;
  category: string;
  level: 'Basic' | 'Advanced'; // khớp enum CourseLevel
  is_required: boolean;
  is_published: boolean;
  allowed_roles: string[]; // ví dụ ["user","manager","admin"]
}
