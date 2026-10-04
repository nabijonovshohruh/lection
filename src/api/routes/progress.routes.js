const express = require('express');
const controller = require('../controllers/progress.controller');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

const updateRules = { position_seconds: { required: true, type: 'number' } };

router.get('/lesson/:lessonId', controller.getByLesson);
router.post('/lesson/:lessonId', validate(updateRules), controller.updateWatchPosition);
router.get('/course/:courseId', controller.listByCourse);

module.exports = router;
