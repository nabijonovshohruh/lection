const groupsService = require('../../services/groups.service');
const usersService = require('../../services/users.service');

async function listByCourse(req, res, next) {
  try {
    const groups = await groupsService.listGroupsByCourse(req.params.courseId);
    res.json(groups);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const group = await groupsService.getGroupById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const members = await groupsService.listGroupMembers(group.id);
    res.json({ ...group, members });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const group = await groupsService.createGroup(req.body);
    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const group = await groupsService.updateGroup(req.params.id, req.body);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json(group);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await groupsService.deleteGroup(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function assignMentor(req, res, next) {
  try {
    const mentor = await usersService.findById(req.body.mentor_id);
    if (!mentor) return res.status(404).json({ message: 'Mentor (user) not found' });

    const group = await groupsService.assignMentor(req.params.id, mentor.id);
    res.json(group);
  } catch (err) {
    next(err);
  }
}

async function addStudent(req, res, next) {
  try {
    const group = await groupsService.getGroupById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (req.user.role === 'mentor' && group.mentor_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const enrollment = await groupsService.addStudentToGroup(group.id, req.body.user_id);
    res.status(201).json(enrollment);
  } catch (err) {
    if (err.code === 'P0001') {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
}

module.exports = { listByCourse, getById, create, update, remove, assignMentor, addStudent };
