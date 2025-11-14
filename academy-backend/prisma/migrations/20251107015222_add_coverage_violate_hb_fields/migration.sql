-- AlterTable
ALTER TABLE "UserLessonProgress" ADD COLUMN     "coverage_json" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "last_hb_at" TIMESTAMP(3),
ADD COLUMN     "violated_at" TIMESTAMP(3);
