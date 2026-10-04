-- Telegraf session holati (masalan, /newcourse kabi ko'p bosqichli buyruqlar) shu jadvalda saqlanadi,
-- shunda bot qayta ishga tushganda (deploy, crash) foydalanuvchining joriy bosqichi yo'qolmaydi.
CREATE TABLE bot_sessions (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
