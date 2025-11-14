/*
  Warnings:

  - You are about to drop the column `file_type` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `is_private` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `storage_path` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `file_id` on the `Lesson` table. All the data in the column will be lost.
  - Added the required column `byte_size` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mime_type` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storage_key` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storage_provider` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_user_id_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_uploaded_by_fkey";

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_course_id_fkey";

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_file_id_fkey";

-- DropForeignKey
ALTER TABLE "UserCourseProgress" DROP CONSTRAINT "UserCourseProgress_course_id_fkey";

-- DropForeignKey
ALTER TABLE "UserCourseProgress" DROP CONSTRAINT "UserCourseProgress_user_id_fkey";

-- DropForeignKey
ALTER TABLE "UserLessonProgress" DROP CONSTRAINT "UserLessonProgress_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "UserLessonProgress" DROP CONSTRAINT "UserLessonProgress_user_id_fkey";

-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "category" DROP NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "File" DROP COLUMN "file_type",
DROP COLUMN "is_private",
DROP COLUMN "storage_path",
ADD COLUMN     "byte_size" INTEGER NOT NULL,
ADD COLUMN     "mime_type" TEXT NOT NULL,
ADD COLUMN     "public_url" TEXT,
ADD COLUMN     "storage_key" TEXT NOT NULL,
ADD COLUMN     "storage_provider" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Lesson" DROP COLUMN "file_id",
ADD COLUMN     "pdf_file_id" TEXT,
ALTER COLUMN "duration_seconds" SET DEFAULT 0,
ALTER COLUMN "order_index" SET DEFAULT 1,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserLessonProgress" ALTER COLUMN "coverage_json" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "ActivityLog_user_id_idx" ON "ActivityLog"("user_id");

-- CreateIndex
CREATE INDEX "ActivityLog_timestamp_idx" ON "ActivityLog"("timestamp");

-- CreateIndex
CREATE INDEX "Course_created_by_idx" ON "Course"("created_by");

-- CreateIndex
CREATE INDEX "Course_is_published_idx" ON "Course"("is_published");

-- CreateIndex
CREATE INDEX "File_uploaded_by_idx" ON "File"("uploaded_by");

-- CreateIndex
CREATE INDEX "File_storage_provider_idx" ON "File"("storage_provider");

-- CreateIndex
CREATE INDEX "File_storage_key_idx" ON "File"("storage_key");

-- CreateIndex
CREATE INDEX "File_is_active_idx" ON "File"("is_active");

-- CreateIndex
CREATE INDEX "Lesson_course_id_idx" ON "Lesson"("course_id");

-- CreateIndex
CREATE INDEX "Lesson_type_idx" ON "Lesson"("type");

-- CreateIndex
CREATE INDEX "Lesson_order_index_idx" ON "Lesson"("order_index");

-- CreateIndex
CREATE INDEX "Menu_parent_id_idx" ON "Menu"("parent_id");

-- CreateIndex
CREATE INDEX "Menu_order_index_idx" ON "Menu"("order_index");

-- CreateIndex
CREATE INDEX "UserCourseProgress_course_id_idx" ON "UserCourseProgress"("course_id");

-- CreateIndex
CREATE INDEX "UserCourseProgress_user_id_idx" ON "UserCourseProgress"("user_id");

-- CreateIndex
CREATE INDEX "UserLessonProgress_lesson_id_idx" ON "UserLessonProgress"("lesson_id");

-- CreateIndex
CREATE INDEX "UserLessonProgress_user_id_idx" ON "UserLessonProgress"("user_id");

-- CreateIndex
CREATE INDEX "UserLessonProgress_completed_idx" ON "UserLessonProgress"("completed");

-- CreateIndex
CREATE INDEX "UserLessonProgress_violated_at_idx" ON "UserLessonProgress"("violated_at");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_pdf_file_id_fkey" FOREIGN KEY ("pdf_file_id") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLessonProgress" ADD CONSTRAINT "UserLessonProgress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLessonProgress" ADD CONSTRAINT "UserLessonProgress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCourseProgress" ADD CONSTRAINT "UserCourseProgress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCourseProgress" ADD CONSTRAINT "UserCourseProgress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
