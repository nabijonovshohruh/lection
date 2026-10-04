const newCourseFlow = require('./newCourse.flow');
const newGroupFlow = require('./newGroup.flow');
const assignMentorFlow = require('./assignMentor.flow');
const addStudentFlow = require('./addStudent.flow');
const warnStudentFlow = require('./warnStudent.flow');
const newLessonFlow = require('./newLesson.flow');
const reviewHomeworkFlow = require('./reviewHomework.flow');

const flows = {
  [newCourseFlow.TYPE]: newCourseFlow,
  [newGroupFlow.TYPE]: newGroupFlow,
  [assignMentorFlow.TYPE]: assignMentorFlow,
  [addStudentFlow.TYPE]: addStudentFlow,
  [warnStudentFlow.TYPE]: warnStudentFlow,
  [newLessonFlow.TYPE]: newLessonFlow,
  [reviewHomeworkFlow.TYPE]: reviewHomeworkFlow,
};

async function handleFlowText(ctx, next) {
  const flow = ctx.session.flow;
  if (!flow || !flows[flow.type]) return next();
  return flows[flow.type].handleText(ctx);
}

async function handleFlowAction(ctx, next) {
  const flow = ctx.session.flow;
  if (!flow || !flows[flow.type] || !flows[flow.type].handleAction) {
    return next();
  }
  return flows[flow.type].handleAction(ctx);
}

module.exports = { flows, handleFlowText, handleFlowAction };
