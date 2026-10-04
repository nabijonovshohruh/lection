const { requireRole } = require('../middlewares/attachUser.middleware');
const addStudentFlow = require('../flows/addStudent.flow');

module.exports = function registerSharedHandler(bot) {
  // Admin ham, mentor ham o'quvchi qo'sha oladi (mentor faqat o'z guruhiga)
  bot.command('addstudent', requireRole('admin', 'mentor'), addStudentFlow.start);
};
