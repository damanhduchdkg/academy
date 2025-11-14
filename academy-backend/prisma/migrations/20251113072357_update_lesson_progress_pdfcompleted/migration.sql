-- AlterTable
ALTER TABLE "UserLessonProgress" ADD COLUMN     "pdfCompletedPages" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pdfTotalPages" INTEGER NOT NULL DEFAULT 0;
