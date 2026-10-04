-- Har bir oqim (masalan, "Frontend - Sentabr 2026 oqimi") alohida Course hisoblanadi
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    status course_status NOT NULL DEFAULT 'upcoming',
    start_date DATE,
    end_date DATE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_status ON courses(status);
