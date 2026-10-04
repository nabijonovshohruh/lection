const express = require('express');
const controller = require('../controllers/homework.controller');
const requireRole = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

const submitRules = { content: { type: 'string' }, file_url: { type: 'string' } };
const reviewRules = {
  status: { required: true, type: 'string', enum: ['approved', 'rejected'] },
  mentor_comment: { type: 'string' },
};

router.post('/lesson/:lessonId', validate(submitRules), controller.submit);
router.get('/lesson/:lessonId/mine', controller.getMine);
router.get('/pending', requireRole('mentor'), controller.listPending);
router.post('/:id/review', requireRole('admin', 'mentor'), validate(reviewRules), controller.review);

module.exports = router;
