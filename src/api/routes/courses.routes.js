const express = require('express');
const controller = require('../controllers/courses.controller');
const requireRole = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

const createRules = { name: { required: true, type: 'string' } };
const updateRules = {
  name: { type: 'string' },
  description: { type: 'string' },
  status: { type: 'string', enum: ['upcoming', 'active', 'completed', 'archived'] },
  start_date: { type: 'string' },
  end_date: { type: 'string' },
};

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', requireRole('admin'), validate(createRules), controller.create);
router.put('/:id', requireRole('admin'), validate(updateRules), controller.update);
router.delete('/:id', requireRole('admin'), controller.remove);

module.exports = router;
