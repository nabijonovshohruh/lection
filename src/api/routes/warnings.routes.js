const express = require('express');
const controller = require('../controllers/warnings.controller');
const requireRole = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

const createRules = {
  user_id: { required: true, type: 'number' },
  course_id: { required: true, type: 'number' },
  reason: { required: true, type: 'string' },
  lesson_id: { type: 'number' },
};

router.get('/user/:userId', controller.listByUser);
router.post('/', requireRole('admin', 'mentor'), validate(createRules), controller.create);

module.exports = router;
