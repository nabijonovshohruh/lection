const warningsService = require('../../services/warnings.service');

async function listByUser(req, res, next) {
  try {
    const isSelf = Number(req.params.userId) === req.user.id;
    if (!isSelf && req.user.role === 'student') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const warnings = await warningsService.listWarningsByUser(req.params.userId, req.query.course_id);
    res.json(warnings);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const warning = await warningsService.createWarning({ ...req.body, issued_by: req.user.id });
    res.status(201).json(warning);
  } catch (err) {
    next(err);
  }
}

module.exports = { listByUser, create };
