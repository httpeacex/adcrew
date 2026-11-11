import { Buffer } from 'buffer';
import type { Upload } from '@/lib/store';
import { ProductStore as Store } from '@/lib/product-store';
import { aiServices, creditUnits, fileTypes, InputError, maxFileBytes, maxFiles, validateBrief, type Action } from '@/lib/workflow';
import { uploadType } from '@/lib/upload-type';
import { initializeSqlite, type DatabaseSync } from './sqlite';
import { loadSnapshot, saveSnapshot, withDatabaseLock } from './storage';
import seedUrl from './generated/demo.sqlite?url';

Object.assign(globalThis, { Buffer });
let store: Store;
const roleKey = `adcrew-profile:${import.meta.env.BASE_URL}`;
const fileUrls = new Map<number, string>();
export const changes = new BroadcastChannel(`adcrew-changes:${import.meta.env.BASE_URL}`);
function database() { return store.db as unknown as DatabaseSync; }

async function replaceStore(snapshot: Uint8Array) {
  if (store) database().close();
  await initializeSqlite(snapshot);
  store = new Store(':memory:');
}

export async function initializeStore() {
  await withDatabaseLock(async () => {
    let snapshot = await loadSnapshot();
    if (!snapshot) {
      const response = await fetch(seedUrl);
      if (!response.ok) throw new Error('Не удалось загрузить демоданные.');
      snapshot = new Uint8Array(await response.arrayBuffer());
      await saveSnapshot(snapshot);
    }
    await replaceStore(snapshot);
  });
}

export function getStore() { return store; }
export function currentProfile() {
  const id = Number(sessionStorage.getItem(roleKey));
  return id ? store.profile(id) : undefined;
}
export function fileUrl(id: number) {
  const person = currentProfile();
  const file = person && store.file(person, id);
  if (!file) return '';
  if (!fileUrls.has(id)) fileUrls.set(id, URL.createObjectURL(new Blob([new Uint8Array(file.data)], { type: file.type })));
  return fileUrls.get(id)!;
}
function clearFileUrls() {
  for (const url of fileUrls.values()) URL.revokeObjectURL(url);
  fileUrls.clear();
}
export async function refreshStore() {
  const snapshot = await loadSnapshot();
  // File IDs are immutable. Keep displayed URLs alive even when a subsequent form fails.
  if (snapshot) await replaceStore(snapshot);
}

export async function post(url: string, form: FormData, progress: (value: number) => void) {
  try {
    return await withDatabaseLock(async () => {
      await refreshStore();
      const field = (name: string) => String(form.get(name) ?? '');
      if (url === '/api/session') {
        if (field('mode') === 'logout') { sessionStorage.removeItem(roleKey); clearFileUrls(); return { path: '/login' }; }
        const person = field('demo') ? store.profile(Number(field('demo'))) : store.authenticate(field('email').trim(), field('password'));
        if (!person) throw new InputError('Проверьте адрес почты и пароль.', 401);
        sessionStorage.setItem(roleKey, String(person.id));
        clearFileUrls();
        return { path: '/board' };
      }
      const person = currentProfile();
      if (!person) throw new InputError('Войдите в аккаунт.', 401);
      const requestId = field('requestId');
      let id: number;
      if (url.startsWith('/api/product/')) {
        const result = store.productCommand(person, url, Object.fromEntries([...form].map(([key, value]) => [key, String(value)])));
        await saveSnapshot(database().export());
        changes.postMessage('updated');
        return result;
      }
      if (url === '/api/tasks') {
        id = store.create(person, validateBrief(Object.fromEntries(form), 0), requestId);
      } else {
        const match = /^\/api\/tasks\/(\d+)\/(claim|submit|revise|accept)$/.exec(url);
        if (!match) throw new InputError('Страница не найдена.', 404);
        id = Number(match[1]);
        const action = match[2] as Action;
        const files: Upload[] = [];
        const usage = action === 'submit' && field('noAi') !== 'on' ? aiServices.flatMap(service => {
          const value = field(`credit:${service}`).trim();
          return value ? [{ service, units: creditUnits(value) }] : [];
        }) : [];
        if (action === 'submit') {
          if (!usage.length && field('noAi') !== 'on') throw new InputError('Укажите расход или отметьте «Без AI».');
          const entries = form.getAll('files');
          if (!entries.length || entries.length > maxFiles) throw new InputError('Приложите от одного до пяти файлов.');
          for (const entry of entries) {
            if (!(entry instanceof File) || !entry.size || entry.size > maxFileBytes) throw new InputError('Каждый файл должен быть не больше 25 МБ.');
            const data = new Uint8Array(await entry.arrayBuffer());
            const type = uploadType(data);
            if (!fileTypes.includes(type)) throw new InputError('Загрузите PNG, JPEG, WebP или MP4.');
            files.push({ name: entry.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 180).toWellFormed() || 'Креатив', type, data });
            progress(Math.round(files.length * 100 / entries.length));
          }
        }
        store.act(person, id, action, Number(field('version')), requestId, { files, usage, note: field('note') });
      }
      await saveSnapshot(database().export());
      changes.postMessage('updated');
      return { path: `/tasks/${id}` };
    });
  } catch (error) {
    if (error instanceof InputError) throw { error: error.message, field: error.field, status: error.status };
    throw { error: 'Не удалось сохранить данные в браузере. Проверьте свободное место и повторите действие.' };
  }
}
