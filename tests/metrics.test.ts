import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliveryMetrics, productionMetrics } from '../src/lib/metrics.ts';

test('delivery metrics count completed jobs independently of output quantity and keep empty periods undefined', () => {
  assert.deepEqual(deliveryMetrics([]), { count: 0, firstPass: null, onTime: null, revisions: null, materials: 0 });
  assert.deepEqual(deliveryMetrics([
    { deadline: 100, completedAt: 100, quantity: 5, rounds: 1 },
    { deadline: 100, completedAt: 101, quantity: 2, rounds: 3 },
  ]), { count: 2, firstPass: 50, onTime: 50, revisions: 1, materials: 7 });
});

test('production metrics separate weekly boundaries and omit unfinished and future work', () => {
  const day = 86_400_000;
  const now = 30 * day;
  const task = (completedAt: number | null, rounds = 1) => ({ createdAt: 10 * day, deadline: now, completedAt, quantity: 3, rounds });
  const result = productionMetrics([task(now), task(now - day, 3), task(now - 7 * day), task(now - 14 * day), task(null), task(now + day)], now);
  assert.equal(result.current.count, 2);
  assert.equal(result.current.materials, 6);
  assert.equal(result.current.firstPass, 50);
  assert.equal(result.current.revisions, 1);
  assert.equal(result.current.cycle, 19.5 * day);
  assert.equal(result.previous.count, 1);
  assert.equal(result.trend.reduce((sum, count) => sum + count, 0), 2);
  assert.equal(productionMetrics([], now).current.cycle, null);
});
