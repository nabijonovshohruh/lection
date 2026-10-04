-- O'quvchi/mentor va Course + Group orasidagi bog'lanish.
-- Bitta user bitta course'ga faqat bir marta yoziladi (UNIQUE), lekin turli oqimlarda qayta qatnashishi mumkin.
CREATE TABLE enrollments (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    group_id INT REFERENCES groups(id) ON DELETE SET NULL,
    status enrollment_status NOT NULL DEFAULT 'active',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_at TIMESTAMPTZ,
    UNIQUE (user_id, course_id)
);

CREATE INDEX idx_enrollments_group_id ON enrollments(group_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);
