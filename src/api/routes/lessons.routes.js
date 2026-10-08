const express = require('express');
const controller = require('../controllers/lessons.controller');
const requireRole = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

const LESSON_TYPES = ['lecture', 'seminar', 'review'];

const createRules = {
  course_id: { required: true, type: 'number' },
  title: { required: true, type: 'string' },
  order_index: { required: true, type: 'number' },
  video_url: { type: 'string' },
  resource_url: { type: 'string' },
  description: { type: 'string' },
  duration_seconds: { type: 'number' },
  homework_text: { type: 'string' },
  is_published: { type: 'boolean' },
  type: { type: 'string', enum: LESSON_TYPES },
  scheduled_date: { type: 'string' },
  mentor_name: { type: 'string' },
  topics: { type: 'string' },
  start_time: { type: 'string' },
  end_time: { type: 'string' },
};

const updateRules = {
  title: { type: 'string' },
  description: { type: 'string' },
  video_url: { type: 'string' },
  resource_url: { type: 'string' },
  duration_seconds: { type: 'number' },
  homework_text: { type: 'string' },
  order_index: { type: 'number' },
  is_published: { type: 'boolean' },
  type: { type: 'string', enum: LESSON_TYPES },
  scheduled_date: { type: 'string' },
  mentor_name: { type: 'string' },
  topics: { type: 'string' },
  start_time: { type: 'string' },
  end_time: { type: 'string' },
};

router.get('/course/:courseId', controller.listByCourse);
router.get('/:id', controller.getById);
router.post('/', requireRole('admin'), validate(createRules), controller.create);
router.put('/:id', requireRole('admin'), validate(updateRules), controller.update);
router.delete('/:id', requireRole('admin'), controller.remove);

module.exports = router;
