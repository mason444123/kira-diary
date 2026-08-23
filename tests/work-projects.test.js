const assert = require('node:assert/strict');
const {
  normalizeProjects,
  summarizeProjects,
  prioritizedTasks,
  diaryWorkItems,
} = require('../work-projects.js');

const projects = normalizeProjects({
  projects: [{
    id: 'alpha',
    title: 'Альфа',
    status: 'active',
    next_action: 'Проверить оплату',
    blockers: ['Жду доступ'],
    tasks: [
      { id: 'a-done', title: 'Готово', status: 'done', priority: 'high' },
      { id: 'a-today', title: 'Сегодня', status: 'today', priority: 'high' },
      { id: 'a-work', title: 'В работе', status: 'in_progress', priority: 'low' },
    ],
    decisions: [{ date: '2026-08-23', text: 'Не делать фейковое сохранение.' }],
  }],
});

assert.equal(projects.length, 1);
assert.equal(projects[0].tasks.length, 3);
assert.deepEqual(summarizeProjects(projects), {
  activeProjects: 1,
  todayTasks: 1,
  inProgressTasks: 1,
  blockers: 1,
});
assert.deepEqual(prioritizedTasks(projects, 5).map((item) => item.task.id), ['a-work', 'a-today']);

const work = diaryWorkItems({
  '2026-08-23': { date: '2026-08-23', work: { project_id: 'alpha', done: ['Сделал безопасный экран'] } },
  '2026-08-22': { date: '2026-08-22', work: { done: ['Общее действие'] } },
});
assert.equal(work.length, 2);
assert.equal(work[0].projectId, 'alpha');
assert.equal(work[1].projectId, null);
assert.equal(normalizeProjects(null).length, 0);
console.log('work-projects tests passed');
