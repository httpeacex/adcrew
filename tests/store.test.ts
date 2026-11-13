import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Store } from '../src/lib/store.ts';
import type { Brief, Profile } from '../src/lib/workflow.ts';

const people: Profile[] = ['buyer', 'buyer', 'creative', 'creative', 'lead'].map((role, index) => ({
  id: index + 1, role: role as Profile['role'], email: `test${index}@example.com`, name: `Test ${index}`, initials: 'T', color: 'violet',
}));
const [buyer, otherBuyer, creative, otherCreative, lead] = people;
const base = Date.parse('2026-11-10T04:00:00Z');
const hour = 3_600_000;
const brief: Brief = { offer: 'Night Run', geo: 'DE', format: 'image', quantity: 1, description: 'Две версии', references: [], priority: 'high', deadline: base + 5.5 * hour };
const asset = { name: 'concept.png', type: 'image/png', data: Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10) };

test('profiles with mixed-case email addresses can sign in', () => {
  const store = new Store(':memory:');
  try {
    store.addProfile({ ...buyer, email: 'Buyer@Example.com' }, 'pass');
    assert.equal(store.authenticate('Buyer@Example.com', 'pass')?.id, buyer.id);
    assert.equal(store.authenticate('buyer@example.com', 'pass')?.id, buyer.id);
    assert.equal(store.authenticate('buyer@example.com', 'wrong-password'), undefined);
  } finally {
    store.db.close();
  }
});

test('a conflicting claim and forbidden reads leave the original owner intact', () => {
  const store = new Store(':memory:');
  for (const person of people) store.addProfile(person, 'pass');
  const task = store.create(buyer, brief, randomUUID(), base);
  assert.equal(store.task(otherBuyer, task), null);
  store.act(creative, task, 'claim', 0, randomUUID(), {}, base + hour);
  assert.throws(() => store.act(otherCreative, task, 'claim', 0, randomUUID(), {}, base + hour), { status: 409 });
  assert.equal(store.task(otherCreative, task)?.task.creativeId, creative.id);
  assert.equal(store.task(lead, task)?.task.creativeId, creative.id);
  store.db.close();
});

test('two rounds retain files and notes, deduplicate replay and aggregate credits', () => {
  const store = new Store(':memory:');
  for (const person of people) store.addProfile(person, 'pass');
  const task = store.create(buyer, brief, randomUUID(), base);
  store.act(creative, task, 'claim', 0, randomUUID(), {}, base + hour);
  const key = randomUUID();
  const roundOne = { files: [asset], usage: [{ service: 'Runway', units: 12000 }] };
  store.act(creative, task, 'submit', 1, key, roundOne, base + 3 * hour);
  store.act(creative, task, 'submit', 1, key, roundOne, base + 3 * hour);
  assert.throws(() => store.act(creative, task, 'submit', 1, key, { ...roundOne, usage: [] }, base + 3 * hour), { status: 409 });
  store.act(buyer, task, 'revise', 2, randomUUID(), { note: 'Убрать плашку' }, base + 4 * hour);
  assert.throws(() => store.act(creative, task, 'submit', 3, randomUUID(), {}, base + 5 * hour), { status: 400 });
  store.act(creative, task, 'submit', 3, randomUUID(), { files: [asset], usage: [{ service: 'Runway', units: 3500 }] }, base + 5 * hour);
  store.act(buyer, task, 'accept', 4, randomUUID(), {}, base + 6 * hour);
  const detail = store.task(buyer, task)!;
  assert.equal(detail.submissions.length, 2);
  assert.equal(store.list(lead).find(({ id }) => id === task)?.coverId, detail.submissions[0].files[0].id);
  assert.equal(detail.submissions.find(({ round }) => round === 1)?.reviewNote, 'Убрать плашку');
  assert.equal(store.file(otherBuyer, detail.submissions[0].files[0].id), null);
  assert.deepEqual(store.file(lead, detail.submissions[0].files[0].id)?.data, asset.data);
  assert.equal(store.analytics(lead, '2026-11-10', '2026-11-10', base + 6 * hour).usage[0].units, 15500);
  assert.throws(() => store.analytics(buyer, '2026-11-10', '2026-11-10'), { status: 403 });
  store.db.close();
});
