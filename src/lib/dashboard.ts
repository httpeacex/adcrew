import { localDay, type Actor, type Task } from './workflow.ts';

const rank = { urgent: 0, high: 1, normal: 2, low: 3 };
export function dashboardData(input: Task[], actor: Actor, now: number) {
  const tasks = input.filter(t => actor.role === 'lead' || (actor.role === 'buyer' ? t.buyerId === actor.id : t.creativeId === actor.id || (t.status === 'new' && t.creativeId === null)))
    .sort((a,b) => rank[a.priority] - rank[b.priority] || a.deadline - b.deadline || a.id - b.id);
  const own = tasks.filter(t => actor.role !== 'creative' || t.creativeId === actor.id);
  const active = own.filter(t => t.status !== 'done');
  const done = own.filter(t => t.status === 'done');
  const completedToday = done.filter(t => t.completedAt !== null && localDay(t.completedAt) === localDay(now));
  const attention = active.filter(t => t.deadline - now <= 2 * 3600000)
    .sort((a,b) => a.deadline - b.deadline)
    .map(task => ({task, reason: task.deadline < now ? 'Просрочено' : 'Риск срыва срока'}));
  const free = tasks.filter(t => t.status === 'new' && t.creativeId === null);
  return { tasks: own, mine: active, free, review: own.filter(t => t.status === 'review'), completedToday, attention,
    counts: {total: own.length, active: active.length, progress: own.filter(t => t.status === 'progress').length,
      revision: own.filter(t => t.status === 'revision').length, review: own.filter(t => t.status === 'review').length, done: done.length, free: free.length},
  };
}
