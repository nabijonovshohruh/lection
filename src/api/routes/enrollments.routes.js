const express = require('express');
const controller = require('../controllers/enrollments.controller');
const requireRole = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

const grantRules = {
  user_id: { required: true, type: 'number' },
  course_id: { required: true, type: 'number' },
  group_id: { type: 'number' },
};
const revokeRules = {
  user_id: { required: true, type: 'number' },
  course_id: { required: true, type: 'number' },
};

router.get('/course/:courseId', requireRole('admin'), controller.listByCourse);
router.post('/', requireRole('admin'), validate(grantRules), controller.grant);
router.post('/revoke', requireRole('admin'), validate(revokeRules), controller.revoke);

module.exports = router;
