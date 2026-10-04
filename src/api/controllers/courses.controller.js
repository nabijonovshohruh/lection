const coursesService = require('../../services/courses.service');

async function list(req, res, next) {
  try {
    const courses = await coursesService.listCoursesForUser(req.user);
    res.json(courses);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const course = await coursesService.getCourseById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    const hasAccess = await coursesService.userHasCourseAccess(req.user, course.id);
    if (!hasAccess) return res.status(403).json({ message: 'Forbidden' });

    res.json(course);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const course = await coursesService.createCourse({ ...req.body, created_by: req.user.id });
    res.status(201).json(course);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const course = await coursesService.updateCourse(req.params.id, req.body);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await coursesService.deleteCourse(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };
