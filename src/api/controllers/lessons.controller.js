const lessonsService = require('../../services/lessons.service');
const coursesService = require('../../services/courses.service');
const progressService = require('../../services/progress.service');

async function listByCourse(req, res, next) {
  try {
    const { courseId } = req.params;
    const hasAccess = await coursesService.userHasCourseAccess(req.user, courseId);
    if (!hasAccess) return res.status(403).json({ message: 'Forbidden' });

    const onlyPublished = req.user.role === 'student';
    const lessons = await lessonsService.listLessonsByCourse(courseId, { onlyPublished });
    res.json(lessons);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const lesson = await lessonsService.getLessonById(req.params.id);
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

    const hasAccess = await coursesService.userHasCourseAccess(req.user, lesson.course_id);
    if (!hasAccess) return res.status(403).json({ message: 'Forbidden' });

    if (req.user.role === 'student') {
      const unlocked = await progressService.isLessonUnlockedForUser(req.user.id, lesson);
      if (!unlocked) {
        return res.status(403).json({ message: "Bu dars hali qulflangan — avvalgi darsni tugating" });
      }
    }

    res.json(lesson);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const lesson = await lessonsService.createLesson(req.body);
    res.status(201).json(lesson);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const lesson = await lessonsService.updateLesson(req.params.id, req.body);
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    res.json(lesson);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await lessonsService.deleteLesson(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listByCourse, getById, create, update, remove };
