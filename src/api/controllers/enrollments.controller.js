const enrollmentsService = require('../../services/enrollments.service');

async function listByCourse(req, res, next) {
  try {
    const enrollments = await enrollmentsService.listEnrollmentsForCourse(req.params.courseId);
    res.json(enrollments);
  } catch (err) {
    next(err);
  }
}

async function grant(req, res, next) {
  try {
    const enrollment = await enrollmentsService.grantAccess(
      req.body.user_id,
      req.body.course_id,
      req.body.group_id || null
    );
    res.status(201).json(enrollment);
  } catch (err) {
    next(err);
  }
}

async function revoke(req, res, next) {
  try {
    const enrollment = await enrollmentsService.revokeAccess(req.body.user_id, req.body.course_id);
    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' });
    res.json(enrollment);
  } catch (err) {
    next(err);
  }
}

module.exports = { listByCourse, grant, revoke };
