CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'mentor', 'student');
CREATE TYPE course_status AS ENUM ('upcoming', 'active', 'completed', 'archived');
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'removed', 'dropped');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected');
