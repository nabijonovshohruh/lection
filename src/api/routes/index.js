const express = require('express');
const telegramAuth = require('../middlewares/telegramAuth.middleware');
const coursesRoutes = require('./courses.routes');
const lessonsRoutes = require('./lessons.routes');
const groupsRoutes = require('./groups.routes');
const usersRoutes = require('./users.routes');
const progressRoutes = require('./progress.routes');
const warningsRoutes = require('./warnings.routes');
const homeworkRoutes = require('./homework.routes');

const router = express.Router();

router.use(telegramAuth);

router.use('/courses', coursesRoutes);
router.use('/lessons', lessonsRoutes);
router.use('/groups', groupsRoutes);
router.use('/users', usersRoutes);
router.use('/progress', progressRoutes);
router.use('/warnings', warningsRoutes);
router.use('/homework', homeworkRoutes);

module.exports = router;
