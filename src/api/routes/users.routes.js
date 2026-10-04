const express = require('express');
const controller = require('../controllers/users.controller');
const requireRole = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

const updateRules = {
  full_name: { type: 'string' },
  phone: { type: 'string' },
  role: { type: 'string', enum: ['admin', 'mentor', 'student'] },
  is_active: { type: 'boolean' },
};

router.get('/me', controller.me);
router.get('/', requireRole('admin'), controller.list);
router.get('/:id', requireRole('admin', 'mentor'), controller.getById);
router.put('/:id', validate(updateRules), controller.update);

module.exports = router;
