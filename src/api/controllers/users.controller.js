const usersService = require('../../services/users.service');

async function me(req, res, next) {
  try {
    const enrollments = await usersService.getMyEnrollments(req.user.id);
    console.log(`[users.me] javob qaytarilmoqda: user#${req.user.id} role='${req.user.role}'`);
    res.json({ ...req.user, enrollments });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const users = await usersService.listUsers({ role: req.query.role });
    res.json(users);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const user = await usersService.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const enrollments = await usersService.getMyEnrollments(user.id);
    res.json({ ...user, enrollments });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const isSelf = Number(req.params.id) === req.user.id;
    if (!isSelf && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // O'zini tahrirlayotgan admin bo'lmagan foydalanuvchi faqat telefon raqamini o'zgartira oladi
    const fields = isSelf && req.user.role !== 'admin' ? { phone: req.body.phone } : req.body;

    const user = await usersService.updateUser(req.params.id, fields);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { me, list, getById, update };
