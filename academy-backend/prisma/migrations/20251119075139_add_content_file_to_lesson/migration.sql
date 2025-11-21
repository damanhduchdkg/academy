-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "content_file_id" TEXT;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_content_file_id_fkey" FOREIGN KEY ("content_file_id") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
