CREATE TABLE homework_submissions (
    id BIGSERIAL PRIMARY KEY,
    lesson_id INT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    file_url TEXT,
    status submission_status NOT NULL DEFAULT 'pending',
    mentor_comment TEXT,
    reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    UNIQUE (lesson_id, user_id)
);

CREATE INDEX idx_homework_submissions_lesson_id ON homework_submissions(lesson_id);
CREATE INDEX idx_homework_submissions_user_id ON homework_submissions(user_id);
