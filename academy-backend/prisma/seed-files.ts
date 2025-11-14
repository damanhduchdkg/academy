/* prisma/seed-files.ts */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const db: any = prisma; // <-- dùng any để loại bỏ kiểm tra kiểu cứng

/** THAY username này cho đúng user đang có trong DB */
const UPLOADER_USERNAME = 'admin';

/** Đường dẫn file demo cần có trước khi seed */
const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
const PDF_KEY = 'docs/demo.pdf';
const MP4_KEY = 'videos/sample.mp4';

function ensureFileExists(key: string) {
  const abs = path.join(UPLOADS_ROOT, key);
  if (!fs.existsSync(abs)) {
    throw new Error(
      `Không thấy file: ${abs}\nHãy copy file thật vào đúng đường dẫn rồi seed lại.`
    );
  }
}

/** Tạo File:
 *  - Thử schema MỚI: mime_type + storage_provider/storage_key/public_url
 *  - Nếu fail, rơi về schema CŨ: file_type + storage_path (+ is_private)
 */
async function createFileSmart(opts: {
  label: string;
  fileName: string;
  mime: string;           // ví dụ 'application/pdf' | 'video/mp4'
  storageKey?: string;    // dùng cho local
  publicUrl?: string|null;// dùng cho redirect
  uploaderId: string;
}) {
  const { label, fileName, mime, storageKey, publicUrl, uploaderId } = opts;

  // 1) Thử schema MỚI
  try {
    const created = await db.file.create({
      data: {
        file_name: fileName,
        mime_type: mime,
        storage_provider: publicUrl ? 'url' : 'local',
        storage_key: publicUrl ? '' : (storageKey ?? ''),
        public_url: publicUrl ?? null,
        uploaded_by: uploaderId,
        is_active: true,
        byte_size: 0,
      } as any,
    });
    console.log(`✓ [NEW] File ${label}:`, created.id);
    return created as any;
  } catch {
    // 2) Fallback schema CŨ
    const createdLegacy = await db.file.create({
      data: {
        file_name: fileName,
        file_type: mime.startsWith('video')
          ? 'mp4'
          : mime.includes('pdf')
          ? 'pdf'
          : mime,
        storage_path: publicUrl ?? storageKey, // nhét URL vào storage_path nếu là public
        uploaded_by: uploaderId,
        is_active: true,
        // schema cũ có thể có is_private: cứ set nếu có, DB sẽ nhận nếu đúng cột
        is_private: !publicUrl,
      } as any,
    });
    console.log(`✓ [LEGACY] File ${label}:`, createdLegacy.id);
    return createdLegacy as any;
  }
}

/** Tạo Lesson PDF:
 *  - Thử new: pdf_file_id
 *  - Fallback legacy: pdf_url
 */
async function createPdfLesson(courseId: string, fileId: string, fallbackUrl: string) {
  try {
    const created = await db.lesson.create({
      data: {
        course_id: courseId,
        title: 'Tài liệu PDF – Demo',
        type: 'pdf',
        pdf_file_id: fileId,          // new
        duration_seconds: 600,
        order_index: 1,
        is_mandatory: true,
      } as any,
    });
    console.log('✓ [NEW] Lesson PDF:', created.id);
    return created as any;
  } catch {
    const createdLegacy = await db.lesson.create({
      data: {
        course_id: courseId,
        title: 'Tài liệu PDF – Demo',
        type: 'pdf',
        pdf_url: fallbackUrl,         // legacy
        duration_seconds: 600,
        order_index: 1,
        is_mandatory: true,
      } as any,
    });
    console.log('✓ [LEGACY] Lesson PDF:', createdLegacy.id);
    return createdLegacy as any;
  }
}

/** Tạo Lesson Video:
 *  - Ưu tiên liên kết file nội bộ (new: file_id / legacy: file_id cũng có thể tồn tại)
 *  - Nếu không dùng file, truyền youtubeUrl (video_url)
 */

async function createVideoLesson(
  courseId: string,
  opts: { fileId?: string; youtubeUrl?: string },
  index: number
) {
  // nếu có file nội bộ -> dùng /files/:id, ngược lại dùng youtubeUrl
  const backendHost = process.env.BACKEND_PUBLIC_ORIGIN || 'http://localhost:3000';
  const resolvedVideoUrl = opts.fileId
    ? `${backendHost}/files/${opts.fileId}`  // stream từ BE
    : (opts.youtubeUrl ?? null);

  const created = await db.lesson.create({
    data: {
      course_id: courseId,
      title: index === 2 ? 'Video MP4 – Demo' : 'YouTube – Demo',
      type: 'video',
      video_url: resolvedVideoUrl,      // ✅ chỉ dùng video_url, KHÔNG còn file_id
      duration_seconds: index === 2 ? 500 : 480,
      order_index: index,
      is_mandatory: index === 2,
    } as any,
  });

  console.log('✓ Lesson VIDEO:', created.id);
  return created as any;
}

async function main() {
  // 0) User upload
  const uploader = await prisma.user.findFirst({
    where: { username: UPLOADER_USERNAME },
    select: { id: true, username: true },
  });
  if (!uploader) {
    throw new Error(`Không tìm thấy user username="${UPLOADER_USERNAME}". Sửa biến UPLOADER_USERNAME ở đầu file.`);
  }

  // 1) File phải tồn tại trước khi seed
  ensureFileExists(PDF_KEY);
  ensureFileExists(MP4_KEY);

  // 2) Tạo File (nội bộ + external URL)
  const pdfInternal = await createFileSmart({
    label: 'PDF nội bộ',
    fileName: 'demo.pdf',
    mime: 'application/pdf',
    storageKey: PDF_KEY,
    uploaderId: uploader.id,
  });

  const mp4Internal = await createFileSmart({
    label: 'MP4 nội bộ',
    fileName: 'sample.mp4',
    mime: 'video/mp4',
    storageKey: MP4_KEY,
    uploaderId: uploader.id,
  });

  const pdfExternal = await createFileSmart({
    label: 'PDF public',
    fileName: 'external.pdf',
    mime: 'application/pdf',
    publicUrl: 'https://example.com/some.pdf',
    uploaderId: uploader.id,
  });

  // 3) Course demo
  const course = (await db.course.create({
    data: {
      title: 'Khoá học Demo',
      description: 'Khoá dùng để test file/pdf/video',
      category: 'Demo',
      level: 'Basic',
      is_required: false,
      is_published: true,
      allowed_roles: ['user', 'manager', 'admin'],
      created_by: uploader.id,
    } as any,
  })) as any;
  console.log('✓ Course:', course.id);

  // 4) Lesson PDF – ưu tiên liên kết fileId (new), fallback dùng URL (legacy)
  const backendHost = process.env.BACKEND_PUBLIC_ORIGIN || 'http://localhost:3000';
  const fallbackPdfUrl = `${backendHost}/files/${pdfExternal.id}`;
  await createPdfLesson(course.id, pdfInternal.id, fallbackPdfUrl);

  // 5) Lesson VIDEO (file nội bộ)
  await createVideoLesson(course.id, { fileId: mp4Internal.id }, 2);

  // 6) Lesson VIDEO (YouTube)
  await createVideoLesson(course.id, { youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' }, 3);

  console.log('🎉 Seed xong. Mở FE để test các bài học vừa tạo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());