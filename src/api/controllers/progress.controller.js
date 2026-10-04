const progressService = require('../../services/progress.service');
const coursesService = require('../../services/courses.service');
const lessonsService = require('../../services/lessons.service');

async function getByLesson(req, res, next) {
  try {
    const lesson = await lessonsService.getLessonById(req.params.lessonId);
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

    const hasAccess = await coursesService.userHasCourseAccess(req.user, lesson.course_id);
    if (!hasAccess) return res.status(403).json({ message: 'Forbidden' });

    const progress = await progressService.getOrCreateProgress(req.user.id, lesson.id);
    res.json(progress);
  } catch (err) {
    next(err);
  }
}

async function updateWatchPosition(req, res, next) {
  try {
    const lesson = await lessonsService.getLessonById(req.params.lessonId);
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

    const hasAccess = await coursesService.userHasCourseAccess(req.user, lesson.course_id);
    if (!hasAccess) return res.status(403).json({ message: 'Forbidden' });

    const progress = await progressService.updateWatchPosition(
      req.user.id,
      lesson.id,
      req.body.position_seconds
    );
    res.json(progress);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ message: err.message });
    next(err);
  }
}

async function listByCourse(req, res, next) {
  try {
    const { courseId } = req.params;
    const hasAccess = await coursesService.userHasCourseAccess(req.user, courseId);
    if (!hasAccess) return res.status(403).json({ message: 'Forbidden' });

    if (req.user.role === 'student') {
      const progress = await progressService.listProgressByCourse(req.user.id, courseId);
      return res.json(progress);
    }

    const progress = await progressService.listCourseProgressForMentor(courseId);
    res.json(progress);
  } catch (err) {
    next(err);
  }
}

module.exports = { getByLesson, updateWatchPosition, listByCourse };
