(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.KiraProjects = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const TASK_ORDER = { in_progress: 0, today: 1, inbox: 2, waiting: 3, done: 9 };

  function asArray(value) { return Array.isArray(value) ? value : []; }
  function safeText(value) { return typeof value === 'string' ? value.trim() : ''; }

  function normalizeTask(task, projectId) {
    const source = task && typeof task === 'object' ? task : {};
    return {
      id: safeText(source.id),
      title: safeText(source.title) || 'Без названия',
      status: safeText(source.status) || 'inbox',
      priority: safeText(source.priority) || 'normal',
      updated_at: safeText(source.updated_at),
      projectId,
    };
  }

  function normalizeProjects(payload) {
    return asArray(payload && payload.projects).map((project) => {
      const source = project && typeof project === 'object' ? project : {};
      const id = safeText(source.id);
      return {
        id,
        title: safeText(source.title) || 'Без названия',
        description: safeText(source.description),
        status: safeText(source.status) || 'active',
        next_action: safeText(source.next_action),
        blockers: asArray(source.blockers).map(safeText).filter(Boolean),
        tasks: asArray(source.tasks).map((task) => normalizeTask(task, id)),
        decisions: asArray(source.decisions).filter((item) => item && typeof item === 'object').map((item) => ({
          date: safeText(item.date), text: safeText(item.text),
        })).filter((item) => item.text),
      };
    }).filter((project) => project.id || project.title !== 'Без названия');
  }

  function summarizeProjects(projects) {
    const active = projects.filter((project) => project.status === 'active');
    const tasks = projects.flatMap((project) => project.tasks);
    return {
      activeProjects: active.length,
      todayTasks: tasks.filter((task) => task.status === 'today').length,
      inProgressTasks: tasks.filter((task) => task.status === 'in_progress').length,
      blockers: active.reduce((total, project) => total + project.blockers.length, 0),
    };
  }

  function prioritizedTasks(projects, limit) {
    return projects.flatMap((project) => project.tasks.map((task) => ({ project, task })))
      .filter(({ task }) => task.status !== 'done')
      .sort((left, right) => {
        const status = (TASK_ORDER[left.task.status] ?? 4) - (TASK_ORDER[right.task.status] ?? 4);
        if (status) return status;
        const priority = Number(right.task.priority === 'high') - Number(left.task.priority === 'high');
        if (priority) return priority;
        return right.task.updated_at.localeCompare(left.task.updated_at);
      })
      .slice(0, Number.isFinite(limit) ? limit : 5);
  }

  function diaryWorkItems(entries) {
    return Object.values(entries && typeof entries === 'object' ? entries : {})
      .filter((entry) => entry && typeof entry === 'object')
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .flatMap((entry) => {
        const work = entry.work && typeof entry.work === 'object' ? entry.work : {};
        const projectId = safeText(work.project_id);
        const projectName = safeText(work.project);
        return asArray(work.done).map((text) => ({
          date: safeText(entry.date),
          text: safeText(text),
          projectId: projectId || null,
          projectName: projectName || null,
        })).filter((item) => item.text);
      });
  }

  return { normalizeProjects, summarizeProjects, prioritizedTasks, diaryWorkItems };
});
