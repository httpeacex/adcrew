import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actionsFor, creditUnits, intervals, reportPeriod, validateBrief } from '../src/lib/workflow.ts';

test('only the buyer who owns the task can review it', () => {
  const task = { status: 'review' as const, buyerId: 1, creativeId: 3 };
  assert.deepEqual(actionsFor({ id: 1, role: 'buyer' }, task), ['revise', 'accept']);
  assert.deepEqual(actionsFor({ id: 2, role: 'buyer' }, task), []);
  assert.deepEqual(actionsFor({ id: 5, role: 'lead' }, task), []);
});

test('whole cycle, production and review include separate rounds', () => {
  const hours = 3_600_000;
  const events = ['new', 'progress', 'review', 'revision', 'review', 'done'] as const;
  const times = [0, 1, 3, 4, 5, 6];
  assert.deepEqual(intervals(events.map((status, index) => ({ toStatus: status, at: times[index] * hours }))), {
    cycle: 6 * hours, production: 3 * hours, review: 2 * hours,
  });
});

test('credits preserve decimals, and invalid dates are rejected', () => {
  assert.equal(creditUnits('3,5') + creditUnits('12'), 15500);
  assert.throws(() => creditUnits('0.0001'));
  assert.throws(() => creditUnits('-2'));
  assert.throws(() => reportPeriod('2026-02-30', '2026-03-01'));
  assert.equal(reportPeriod('2026-11-10', '2026-11-10').from, Date.parse('2026-11-09T19:00:00Z'));
  assert.throws(() => validateBrief({ offer: 'Launch', geo: 'DE', format: 'image', quantity: '0' }));
});
