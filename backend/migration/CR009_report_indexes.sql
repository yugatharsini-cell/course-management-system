USE course_management;

-- CR-009: indexes that support the reporting queries.
-- Run this file ONCE (MySQL has no CREATE INDEX IF NOT EXISTS).
-- Already covered by existing keys:
--   enrollments(student_id, course_id)  -> UNIQUE key
--   enrollments(course_id)              -> foreign key index

-- "Enrollments in the last 30 days" and date ordering
CREATE INDEX idx_enrollments_enrolled_at
  ON enrollments (enrolled_at);

-- Student report: latest / earliest / recent enrollments
CREATE INDEX idx_enrollments_student_enrolled
  ON enrollments (student_id, enrolled_at);

-- Category breakdown (GROUP BY category)
CREATE INDEX idx_courses_category
  ON courses (category);

-- Total students (WHERE role = 'student')
CREATE INDEX idx_users_role
  ON users (role);
