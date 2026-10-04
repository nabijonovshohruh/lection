-- Video darslar va topshiriqlar bevosita Course'ga biriktiriladi
CREATE TABLE lessons (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url TEXT,
    duration_seconds INT NOT NULL DEFAULT 0,
    homework_text TEXT,
    order_index INT NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (course_id, order_index)
);

CREATE INDEX idx_lessons_course_id ON lessons(course_id);
