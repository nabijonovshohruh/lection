-- Har bir Course ichidagi mini-guruhlar (odatda 30 kishigacha), har biriga 1 mentor biriktiriladi
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    mentor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (course_id, name)
);

CREATE INDEX idx_groups_course_id ON groups(course_id);
CREATE INDEX idx_groups_mentor_id ON groups(mentor_id);
