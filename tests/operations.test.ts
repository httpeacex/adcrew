import assert from 'node:assert/strict';
import { test } from 'node:test';
import { measuredTime, readWorkCalendar, saveWorkCalendar } from '../src/lib/work-calendar.ts';
import { Store } from '../src/lib/store.ts';
import { operationsSummary } from '../src/lib/operations-report.ts';
test('summary separates task creation, acceptance and revision events within period',()=>{
 const tasks=[{id:1,status:'done',createdAt:1,completedAt:20,claimedAt:5,deadline:10,buyerId:1,creativeId:3},{id:2,status:'progress',createdAt:16,completedAt:null,claimedAt:17,deadline:40,buyerId:2,creativeId:4}] as never;
 const r=operationsSummary(tasks,[{taskId:1,action:'revise',at:12}],10,30,25);
 assert.equal(r.created,1);assert.equal(r.completed,1);assert.equal(r.averageElapsed,15);assert.equal(r.revisions,1);assert.equal(r.revisionPercent,100);assert.equal(r.overdue.length,1);
});


test('period-end status uses the latest historical event before the cutoff', () => {
  const tasks = [
    { id: 1, status: 'done', createdAt: 1, claimedAt: 2, completedAt: 40, deadline: 15 },
    { id: 2, status: 'progress', createdAt: 30, claimedAt: 31, completedAt: null, deadline: 45 },
    { id: 3, status: 'progress', createdAt: 0, claimedAt: 2, completedAt: null, deadline: 45, deletedAt: 14 },
    { id: 4, status: 'new', createdAt: -2, claimedAt: null, completedAt: null, deadline: 45 },
  ] as never;
  const events = [
    { taskId: 1, action: 'create', toStatus: 'new', at: 1 },
    { taskId: 1, action: 'claim', toStatus: 'progress', at: 2 },
    { taskId: 1, action: 'submit', toStatus: 'review', at: 19 },
    { taskId: 1, action: 'revise', toStatus: 'revision', at: 20 },
    { taskId: 1, action: 'accept', toStatus: 'done', at: 40 },
  ] as const;
  const report = operationsSummary(tasks, [...events], 0, 20, 50);
  assert.deepEqual(report.statuses, { new: 0, progress: 0, revision: 0, review: 1, done: 0 });
  assert.equal(report.overdue[0].status, 'review');
  assert.equal(report.overdue[0].delay, 5);
});


test('the work calendar excludes nights and days outside the selected schedule', () => {
  const hour = 3_600_000;
  const friday = Date.parse('2026-11-13T17:00:00+05:00');
  const monday = Date.parse('2026-11-16T10:30:00+05:00');
  const calendar = { enabled: true, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' };
  assert.equal(measuredTime(friday, monday, calendar), 2.5 * hour);
  assert.equal(measuredTime(friday, monday + 14 * 24 * hour, calendar), 92.5 * hour);
  assert.equal(measuredTime(friday, monday), monday - friday);
});

test('only the lead can persist a valid workspace schedule', () => {
  const store = new Store(':memory:');
  const fields = { enabled: 'true', days: '1,4', start: '10:00', end: '17:30' };
  try {
    assert.equal(readWorkCalendar(store).enabled, false);
    assert.throws(() => saveWorkCalendar(store, { id: 1, role: 'buyer' }, fields), { status: 403 });
    assert.throws(() => saveWorkCalendar(store, { id: 2, role: 'lead' }, { ...fields, end: '09:00' }));
    saveWorkCalendar(store, { id: 2, role: 'lead' }, fields);
    assert.deepEqual(readWorkCalendar(store), { enabled: true, days: [1, 4], start: '10:00', end: '17:30' });
  } finally { store.db.close(); }
});
