-- 4 ta ogohlantirish tizimi: warning_number har bir (user, course) juftligi uchun
-- avtomatik hisoblanadi (triggerga qarang), 4-chi warning'da enrollment avtomatik "removed" bo'ladi.
CREATE TABLE warnings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id INT REFERENCES lessons(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    warning_number INT NOT NULL,
    issued_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_warnings_user_course ON warnings(user_id, course_id);
