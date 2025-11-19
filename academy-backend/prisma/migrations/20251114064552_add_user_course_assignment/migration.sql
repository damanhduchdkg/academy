-- CreateTable
CREATE TABLE "UserCourseAssignment" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCourseAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCourseAssignment_user_id_idx" ON "UserCourseAssignment"("user_id");

-- CreateIndex
CREATE INDEX "UserCourseAssignment_course_id_idx" ON "UserCourseAssignment"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserCourseAssignment_user_id_course_id_key" ON "UserCourseAssignment"("user_id", "course_id");

-- AddForeignKey
ALTER TABLE "UserCourseAssignment" ADD CONSTRAINT "UserCourseAssignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCourseAssignment" ADD CONSTRAINT "UserCourseAssignment_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
