-- 1) Mini-guruh sig'imini (odatda 30) nazorat qilish: guruh to'lgan bo'lsa, yangi yozilishga yo'l qo'ymaslik
CREATE OR REPLACE FUNCTION check_group_capacity() RETURNS TRIGGER AS $$
DECLARE
    group_capacity INT;
    current_count INT;
BEGIN
    IF NEW.group_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT capacity INTO group_capacity FROM groups WHERE id = NEW.group_id;

    SELECT COUNT(*) INTO current_count
    FROM enrollments
    WHERE group_id = NEW.group_id
      AND status = 'active'
      AND id <> COALESCE(NEW.id, -1);

    IF current_count >= group_capacity THEN
        RAISE EXCEPTION 'Group % is full (capacity %)', NEW.group_id, group_capacity;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_group_capacity
    BEFORE INSERT OR UPDATE ON enrollments
    FOR EACH ROW
    EXECUTE FUNCTION check_group_capacity();

-- 2) Har bir warning kiritilganda (user, course) bo'yicha tartib raqamini avtomatik belgilash
CREATE OR REPLACE FUNCTION assign_warning_number() RETURNS TRIGGER AS $$
DECLARE
    warning_count INT;
BEGIN
    SELECT COUNT(*) INTO warning_count
    FROM warnings
    WHERE user_id = NEW.user_id AND course_id = NEW.course_id;

    NEW.warning_number := warning_count + 1;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assign_warning_number
    BEFORE INSERT ON warnings
    FOR EACH ROW
    EXECUTE FUNCTION assign_warning_number();

-- 3) 4-chi warning kiritilganda o'quvchini shu kursdan avtomatik chetlatish (enrollment -> removed)
CREATE OR REPLACE FUNCTION handle_warning_threshold() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.warning_number >= 4 THEN
        UPDATE enrollments
        SET status = 'removed', removed_at = now()
        WHERE user_id = NEW.user_id AND course_id = NEW.course_id AND status = 'active';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_handle_warning_threshold
    AFTER INSERT ON warnings
    FOR EACH ROW
    EXECUTE FUNCTION handle_warning_threshold();
