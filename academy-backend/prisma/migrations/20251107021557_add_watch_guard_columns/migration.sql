-- AlterTable
ALTER TABLE "UserLessonProgress" ADD COLUMN     "violation_reason" TEXT,
ALTER COLUMN "coverage_json" DROP NOT NULL;
