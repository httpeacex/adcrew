import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

process.env.KADR_DB_PATH = `.data/pages-seed-${randomUUID()}.sqlite`;
process.env.KADR_DEMO_MODE = '1';
const { getStore } = await import('../src/lib/data.ts');
const store = getStore();
// Always publish fresh synthetic seed data, never the working database or sessions.
store.db.prepare('DELETE FROM sessions').run();
mkdirSync('browser/generated', { recursive: true });
const { readFileSync, unlinkSync } = await import('node:fs');
store.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
store.db.close();
writeFileSync('browser/generated/demo.sqlite', readFileSync(process.env.KADR_DB_PATH));
unlinkSync(process.env.KADR_DB_PATH);
