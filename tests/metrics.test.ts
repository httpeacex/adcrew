import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliveryMetrics } from '../src/lib/metrics.ts';

test('delivery metrics count completed jobs independently of output quantity and keep empty periods undefined', () => {
  assert.deepEqual(deliveryMetrics([]), { count: 0, firstPass: null, onTime: null, revisions: null, materials: 0 });
  assert.deepEqual(deliveryMetrics([
    { deadline: 100, completedAt: 100, quantity: 5, rounds: 1 },
    { deadline: 100, completedAt: 101, quantity: 2, rounds: 3 },
  ]), { count: 2, firstPass: 50, onTime: 50, revisions: 1, materials: 7 });
});
