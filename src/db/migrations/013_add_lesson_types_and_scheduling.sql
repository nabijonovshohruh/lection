-- Dars rejasi (syllabus): har bir dars LECTURE (video), SEMINAR (jonli savol-javob)
-- yoki REVIEW (takrorlash) turlaridan biri bo'lishi mumkin, tegishli maydonlar bilan.
CREATE TYPE lesson_type AS ENUM ('lecture', 'seminar', 'review');

ALTER TABLE lessons
  ADD COLUMN type lesson_type NOT NULL DEFAULT 'lecture',
  ADD COLUMN scheduled_date DATE,
  -- Seminar darslari uchun: kim o'tkazadi, qaysi mavzular muhokama qilinadi,
  -- boshlanish/tugash vaqti (oddiy matn sifatida, masalan "19:00" — aniq
  -- vaqt mintaqasi bilan bog'liq murakkablikdan qochish uchun).
  ADD COLUMN mentor_name TEXT,
  ADD COLUMN topics TEXT,
  ADD COLUMN start_time TEXT,
  ADD COLUMN end_time TEXT;
