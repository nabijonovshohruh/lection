const express = require('express');
const controller = require('../controllers/groups.controller');
const requireRole = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

const createRules = {
  course_id: { required: true, type: 'number' },
  name: { required: true, type: 'string' },
  capacity: { type: 'number' },
};
const updateRules = { name: { type: 'string' }, capacity: { type: 'number' } };
const assignMentorRules = { mentor_id: { required: true, type: 'number' } };
const addStudentRules = { user_id: { required: true, type: 'number' } };

router.get('/course/:courseId', controller.listByCourse);
router.get('/:id', controller.getById);
router.post('/', requireRole('admin'), validate(createRules), controller.create);
router.put('/:id', requireRole('admin'), validate(updateRules), controller.update);
router.delete('/:id', requireRole('admin'), controller.remove);
router.post('/:id/mentor', requireRole('admin'), validate(assignMentorRules), controller.assignMentor);
router.post(
  '/:id/students',
  requireRole('admin', 'mentor'),
  validate(addStudentRules),
  controller.addStudent
);

module.exports = router;
