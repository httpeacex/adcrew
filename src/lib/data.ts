import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { cookies } from 'next/headers';
import { demoProfiles } from './demo-profiles.ts';
import { ProductStore as Store } from './product-store.ts';
import type { Brief } from './workflow.ts';

export const sessionCookie = 'kadr_session';
const databasePath = resolve(/* turbopackIgnore: true */ process.env.KADR_DB_PATH || '.data/kadr.sqlite');
const globalStore = globalThis as typeof globalThis & { kadrStore?: Store };
const hour = 3_600_000;
const examples = [
  ['Neon Dash', 'DE', 'video', 3, 'urgent', 'new', 1, 0, 29],
  ['Fitflow UGC', 'US', 'video', 5, 'high', 'new', 1, 0, 49],
  ['Orbit Pay', 'PL', 'image', 4, 'normal', 'new', 2, 0, 81],
  ['Mellow Club', 'GB', 'animation', 2, 'normal', 'new', 1, 0, 105],
  ['Night Shift', 'CA', 'image', 3, 'high', 'progress', 1, 3, -10],
  ['Bloom Skincare', 'FR', 'video', 2, 'high', 'progress', 2, 4, 51],
  ['Nomad eSIM', 'ES', 'image', 6, 'normal', 'progress', 1, 4, 77],
  ['Pulse Fitness', 'AU', 'animation', 2, 'normal', 'progress', 2, 3, 96],
  ['Luma Travel', 'GB', 'image', 4, 'high', 'review', 1, 3, -3],
  ['Forma Studio', 'IT', 'video', 2, 'normal', 'review', 2, 4, 32],
  ['Soda Lab', 'BR', 'image', 3, 'normal', 'review', 1, 4, 65],
  ['Waves Mobile', 'DE', 'video', 3, 'urgent', 'revision', 1, 3, -8],
  ['Citrus Market', 'MX', 'image', 5, 'normal', 'revision', 2, 4, 48],
  ['Cloudnote', 'US', 'video', 3, 'high', 'done', 1, 3, -24],
  ['Tempo Music', 'GB', 'image', 4, 'normal', 'done', 2, 4, 48],
  ['Horizon Games', 'DE', 'animation', 3, 'normal', 'done', 1, 4, 60],
  ['Goodform', 'CA', 'image', 2, 'low', 'done', 2, 3, 65],
] as const;
const coverSlugs = ['luma-travel', 'soda-lab', 'waves-mobile', 'citrus-market', 'cloudnote', 'tempo-music', 'horizon-games', 'goodform'];

function seed(store: Store) {
  store.atomic(() => {
    if (store.db.prepare("SELECT 1 FROM metadata WHERE key='demo-v1'").get()) return;
    const now = Date.now();
    const password = process.env.KADR_DEMO_PASSWORD || 'Kadr-Demo-2026!';
    for (const person of demoProfiles) store.addProfile(person, password);
    const png = readFileSync(resolve('fixtures/creative.png'));
    const mp4 = readFileSync(resolve('fixtures/creative.mp4'));
    examples.forEach(([offer, geo, format, , priority, status, buyerId, creativeId, due], index) => {
      const buyer = demoProfiles[buyerId - 1];
      const creative = demoProfiles[creativeId - 1];
      const created = now - (38 + index * 5) * hour;
      const task = store.create(buyer, { offer, geo, format, quantity:1, priority, deadline: now + due * hour,
        description: `Подготовить один креатив для оффера ${offer} на рынке ${geo}. Основной акцент — показать продукт в первом кадре. Подготовить один самостоятельный результат с единым призывом к действию.`,
        references: [],
      } satisfies Brief, `demo-${index}-0`, created);
      if (status === 'new') return;
      store.act(creative, task, 'claim', 0, `demo-${index}-1`, {}, created + 2 * hour);
      if (status === 'progress') return;
      const slug = offer.toLowerCase().replaceAll(' ', '-');
      const file = format === 'image' ? { name: `${slug}.png`, type: 'image/png', data: png }
        : { name: `${slug}.mp4`, type: 'video/mp4', data: mp4 };
      const service = format === 'image' ? 'Midjourney' : 'Runway';
      store.act(creative, task, 'submit', 1, `demo-${index}-2`, { files: [file], usage: [{ service, units: (index + 4) * 1000 }] }, created + 9 * hour);
      if (status === 'review') return;
      if (status === 'revision' || index === 13) {
        store.act(buyer, task, 'revise', 2, `demo-${index}-3`, { note: 'Сократить первый экран и оставить один призыв к действию. Поднять контраст текста.' }, created + 13 * hour);
        if (status === 'revision') return;
        store.act(creative, task, 'submit', 3, `demo-${index}-4`, { files: [file], usage: [{ service, units: 3500 }] }, created + 19 * hour);
        store.act(buyer, task, 'accept', 4, `demo-${index}-5`, {}, now - 12 * hour);
        return;
      }
      store.act(buyer, task, 'accept', 2, `demo-${index}-3`, {}, created + (15 + index % 4) * hour);
    });
    store.db.prepare("INSERT INTO metadata VALUES('demo-v1',?)").run(String(now));
  });
}

function seedCovers(store: Store) {
  store.atomic(() => {
    if (store.db.prepare("SELECT 1 FROM metadata WHERE key='demo-covers-v1'").get()) return;
    const submission = store.db.prepare(`SELECT s.id FROM submissions s JOIN tasks t ON t.id = s.taskId
      JOIN task_events e ON e.taskId = s.taskId AND e.round = s.round
      WHERE t.offer = ? AND e.action = 'submit' AND e.requestId LIKE 'demo-%' ORDER BY s.round DESC LIMIT 1`);
    const attach = store.db.prepare("INSERT INTO task_files(submissionId,name,type,data) VALUES(?,?,'image/jpeg',?)");
    for (const slug of coverSlugs) {
      const offer = examples.find(([name]) => name.toLowerCase().replaceAll(' ', '-') === slug)?.[0];
      const row = offer ? submission.get(offer) : undefined;
      if (row) attach.run(row.id, `${slug}-storyboard.jpg`, readFileSync(resolve('fixtures/covers', `${slug}.jpg`)));
    }
    store.db.prepare("INSERT INTO metadata VALUES('demo-covers-v1',?)").run(String(Date.now()));
  });
}

function seedReferenceDemo(store: Store) {
  const scenes = [
    { original: 'Neon Dash', offer: 'Креативы на оффер WeightLoss', format: 'video' },
    { original: 'Fitflow UGC', offer: 'Статики для Nutra (суставы)', format: 'image' },
    { original: 'Night Shift', offer: 'UGC видео для SkinCare', format: 'video' },
    { original: 'Bloom Skincare', offer: 'Креативы для Gambling', format: 'video' },
    { original: 'Luma Travel', offer: 'Видео для Dating (новый оффер)', format: 'video', cover: 'dating' },
    { original: 'Waves Mobile', offer: 'Статика для Finance (кредиты)', format: 'image', cover: 'finance' },
    { original: 'Cloudnote', offer: 'Пакет креативов для WeightLoss', format: 'video', cover: 'weightloss' },
  ] as const;
  store.atomic(() => {
    if (store.db.prepare("SELECT 1 FROM metadata WHERE key='reference-demo-v1'").get()) return;
    const find = store.db.prepare("SELECT t.id FROM tasks t JOIN task_events e ON e.taskId=t.id WHERE t.offer=? AND e.action='create' AND e.requestId=?");
    const title = store.db.prepare('UPDATE tasks SET offer=?,format=?,description=REPLACE(description,?,?) WHERE id=?');
    const updateCover = store.db.prepare(`UPDATE task_files SET name=?,type='image/webp',data=? WHERE name=? AND submissionId IN (
      SELECT s.id FROM submissions s JOIN task_events e ON e.taskId=s.taskId AND e.round=s.round
      WHERE s.taskId=? AND e.action='submit' AND e.requestId LIKE 'demo-%'
    )`);
    for (const scene of scenes) {
      const index = examples.findIndex(([offer]) => offer === scene.original);
      const row = find.get(scene.original, `demo-${index}-0`);
      if (!row) continue;
      title.run(scene.offer, scene.format, scene.original, scene.offer, row.id);
      if ('cover' in scene) {
        const originalName = scene.original.toLowerCase().replaceAll(' ', '-');
        updateCover.run(`${scene.cover}-preview.webp`, readFileSync(resolve('public/reference', `${scene.cover}.webp`)), `${originalName}-storyboard.jpg`, row.id);
      }
    }
    store.db.prepare("INSERT INTO metadata VALUES('reference-demo-v1',?)").run(String(Date.now()));
  });
}

export function demoMode() { return process.env.KADR_DEMO_MODE !== '0'; }

export function getStore() {
  if (!globalStore.kadrStore) {
    mkdirSync(dirname(databasePath), { recursive: true });
    const store = new Store(databasePath);
    try {
      if (demoMode()) { seed(store); seedCovers(store); seedReferenceDemo(store); }
      globalStore.kadrStore = store;
    } catch (error) {
      store.db.close();
      throw error;
    }
  }
  return globalStore.kadrStore;
}

export async function currentProfile() {
  const token = (await cookies()).get(sessionCookie)?.value;
  return token ? getStore().session(token) : undefined;
}

export async function requestSnapshot() { return { now: Date.now(), person: await currentProfile() }; }
