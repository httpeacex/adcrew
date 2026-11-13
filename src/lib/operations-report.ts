import type { Store } from './store.ts';
import { measuredTime, type WorkCalendar } from './work-calendar.ts';
import { InputError, localDay, type Actor, type Status, type Task } from './workflow.ts';

export type RevisionEvent = { taskId: number; action: string; at: number; toStatus?: Status };
const dayMs = 86_400_000;

export function operationsSummary(tasks: Task[], events: RevisionEvent[], from: number, to: number, now: number, calendar?: WorkCalendar | null) {
  const cutoff = Math.min(to, now + 1);
  const reportTime = Math.min(to, now);
  const visible = tasks.filter(task => task.createdAt < cutoff && (task.deletedAt == null || task.deletedAt >= cutoff));
  const taskIds = new Set(visible.map(task => task.id));
  const latest = new Map<number, RevisionEvent>();
  const revised = new Set<number>();
  let revisions = 0;
  for (const event of events) {
    if (!taskIds.has(event.taskId) || event.at >= cutoff) continue;
    if (event.toStatus && event.at >= (latest.get(event.taskId)?.at ?? -Infinity)) latest.set(event.taskId, event);
    if (event.action === 'revise') {
      revised.add(event.taskId);
      if (event.at >= from) revisions++;
    }
  }
  const historicalStatus = (task: Task): Status => latest.get(task.id)?.toStatus ?? task.status;
  const statuses: Record<Status, number> = { new: 0, progress: 0, revision: 0, review: 0, done: 0 };
  const created = visible.filter(task => task.createdAt >= from);
  for (const task of created) statuses[historicalStatus(task)]++;
  const completed = visible.filter(task => task.completedAt !== null && task.completedAt >= from && task.completedAt < cutoff);
  const times = completed.flatMap(task => task.claimedAt === null ? [] : [measuredTime(task.claimedAt, task.completedAt!, calendar)]);
  const overdue = visible.flatMap(task => {
    const accepted = task.completedAt !== null && task.completedAt < cutoff ? task.completedAt : null;
    const delay = (accepted ?? reportTime) - task.deadline;
    return delay > 0 && task.deadline >= from && task.deadline < cutoff ? [{ ...task, status: historicalStatus(task), delay }] : [];
  }).sort((a, b) => b.delay - a.delay || a.id - b.id);
  const dailyCounts = new Map<string, { created: number; completed: number }>();
  const dayStart = Date.parse(`${localDay(from)}T00:00:00+05:00`);
  for (let d = dayStart; d < to; d += dayMs) dailyCounts.set(localDay(d), { created: 0, completed: 0 });
  for (const task of created) dailyCounts.get(localDay(task.createdAt))!.created++;
  for (const task of completed) dailyCounts.get(localDay(task.completedAt!))!.completed++;
  const days = [...dailyCounts].map(([day, counts]) => ({ day, ...counts }));
  return {
    created: created.length, completed: completed.length, averageElapsed: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    revisions, revisionPercent: completed.length ? completed.filter(task => revised.has(task.id)).length / completed.length * 100 : null,
    overdue, days, statuses,
  };
}

export function readReportTasks(store: Store, actor: Actor): Task[] {
  if (actor.role !== 'lead') throw new InputError('Отчёт доступен руководителю.', 403);
  const tasks = store.list(actor);
  const deleted = store.db.prepare(`SELECT t.*,b.name AS buyerName,c.name AS creativeName,c.initials AS creativeInitials,c.color AS creativeColor
    FROM tasks t JOIN profiles b ON b.id=t.buyerId LEFT JOIN profiles c ON c.id=t.creativeId WHERE t.deletedAt IS NOT NULL`).all() as unknown as (Omit<Task, 'references'> & { referenceJson: string })[];
  return [...tasks, ...deleted.map(({ referenceJson, ...task }) => ({ ...task, references: JSON.parse(referenceJson) as string[] }))];
}

export function withTaskTimes(store: Store, actor: Actor, tasks: Task[], now: number, calendar?: WorkCalendar | null): Task[] {
  if (!tasks.length) return tasks;
  const rows = store.db.prepare(`SELECT e.taskId,e.toStatus,e.at FROM task_events e JOIN tasks t ON t.id=e.taskId
    WHERE t.deletedAt IS NULL ${actor.role === 'buyer' ? 'AND t.buyerId=?' : ''} ORDER BY e.taskId,e.id`)
    .all(...(actor.role === 'buyer' ? [actor.id] : [])) as { taskId: number; toStatus: Status; at: number }[];
  const histories = new Map<number, typeof rows>();
  for (const event of rows) {
    const history = histories.get(event.taskId) ?? [];
    if (history.length === 0) histories.set(event.taskId, history);
    history.push(event);
  }
  return tasks.map(task => {
    const end = task.completedAt ?? now;
    const history = (histories.get(task.id) ?? []).filter(event => event.at <= end);
    const points = [...history, { toStatus: task.status, at: end }];
    let waiting = 0, production = 0, review = 0;
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1];
      const duration = measuredTime(previous.at, points[i].at, calendar);
      if (previous.toStatus === 'new') waiting += duration;
      if (previous.toStatus === 'progress' || previous.toStatus === 'revision') production += duration;
      if (previous.toStatus === 'review') review += duration;
    }
    return { ...task, timing: { production, review, waiting, sampledAt: now, calendar } };
  });
}
