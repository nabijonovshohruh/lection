const homeworkService = require('../../services/homework.service');
const lessonsService = require('../../services/lessons.service');
const coursesService = require('../../services/courses.service');

async function submit(req, res, next) {
  try {
    const lesson = await lessonsService.getLessonById(req.params.lessonId);
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

    const hasAccess = await coursesService.userHasCourseAccess(req.user, lesson.course_id);
    if (!hasAccess) return res.status(403).json({ message: 'Forbidden' });

    const submission = await homeworkService.submitHomework({
      lesson_id: lesson.id,
      user_id: req.user.id,
      content: req.body.content,
      file_url: req.body.file_url,
    });
    res.status(201).json(submission);
  } catch (err) {
    next(err);
  }
}

async function getMine(req, res, next) {
  try {
    const lesson = await lessonsService.getLessonById(req.params.lessonId);
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

    const hasAccess = await coursesService.userHasCourseAccess(req.user, lesson.course_id);
    if (!hasAccess) return res.status(403).json({ message: 'Forbidden' });

    const submission = await homeworkService.getSubmission(lesson.id, req.user.id);
    res.json(submission || null);
  } catch (err) {
    next(err);
  }
}

async function listPending(req, res, next) {
  try {
    const submissions = await homeworkService.listPendingForMentor(req.user.id);
    res.json(submissions);
  } catch (err) {
    next(err);
  }
}

async function review(req, res, next) {
  try {
    const submission = await homeworkService.getSubmissionById(req.params.id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });

    if (req.user.role === 'mentor') {
      const hasAccess = await coursesService.userHasCourseAccess(req.user, submission.course_id);
      if (!hasAccess) return res.status(403).json({ message: 'Forbidden' });
    }

    const reviewed = await homeworkService.reviewSubmission(req.params.id, {
      status: req.body.status,
      mentor_comment: req.body.mentor_comment,
      reviewed_by: req.user.id,
    });
    res.json(reviewed);
  } catch (err) {
    next(err);
  }
}

module.exports = { submit, getMine, listPending, review };
