import { saveWorkCalendar } from '@/lib/work-calendar';
import { uploadType } from '@/lib/upload-type';
import { cookies } from 'next/headers';
import { after, NextResponse } from 'next/server';
import { archiveDriveFile, deliverTaskUpdate, integrationStatus } from '@/lib/integration-server';
import { currentProfile, demoMode, getStore, sessionCookie } from '@/lib/data';
import { demoProfiles } from '@/lib/demo-profiles';
import type { Upload } from '@/lib/store';
import { aiServices, creditUnits, InputError, fileTypes, maxFileBytes, maxFiles, validateBrief, type Action } from '@/lib/workflow';

type Context = { params: Promise<{ command: string[] }> };
const smallRequest = 128 * 1024;
const sessionOptions = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: process.env.KADR_SECURE_COOKIE === '1' };

function errorResponse(error: unknown) {
  if (error instanceof InputError) return NextResponse.json({ error: error.message, field: error.field }, { status: error.status });
  console.error(error);
  return NextResponse.json({ error: 'Сервис временно недоступен. Попробуйте ещё раз.' }, { status: 500 });
}

function positiveId(value: string | undefined) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || String(id) !== value) throw new InputError('Страница не найдена.', 404);
  return id;
}

async function formBody(request: Request, limit: number) {
  const length = request.headers.get('content-length');
  if (!length || !/^\d+$/.test(length)) throw new InputError('Размер запроса не указан.', 411);
  if (Number(length) > limit) throw new InputError('Размер загрузки превышает лимит.', 413);
  try { return await request.formData(); } catch { throw new InputError('Не удалось прочитать данные формы.'); }
}

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function requestId(form: FormData) {
  const id = field(form, 'requestId');
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new InputError('Обновите страницу и повторите действие.');
  return id;
}


async function uploadFiles(form: FormData): Promise<Upload[]> {
  const entries = form.getAll('files');
  if (entries.length < 1 || entries.length > maxFiles) throw new InputError('Приложите от одного до пяти файлов.');
  const files: Upload[] = [];
  for (const item of entries) {
    if (typeof item === 'string' || !item.size || item.size > maxFileBytes) throw new InputError('Каждый файл должен быть не больше 25 МБ.');
    const data = new Uint8Array(await item.arrayBuffer());
    const type = uploadType(data);
    if (!fileTypes.includes(type)) throw new InputError('Загрузите PNG, JPEG, WebP или MP4.');
    files.push({ name: item.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 180).toWellFormed() || 'Креатив', type, data });
  }
  return files;
}

export async function GET(request: Request, { params }: Context) {
  try {
    const [collection, key, ...rest] = (await params).command;
    if (collection !== 'files' || rest.length) throw new InputError('Страница не найдена.', 404);
    const person = await currentProfile();
    if (!person) throw new InputError('Войдите в аккаунт.', 401);
    const file = getStore().file(person, positiveId(key));
    if (!file) throw new InputError('Файл не найден.', 404);
    const preview = new URL(request.url).searchParams.get('preview') === '1';
    const filename = encodeURIComponent(file.name).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16)}`);
    return new Response(Buffer.from(file.data), { headers: {
      'Content-Type': file.type, 'Content-Length': String(file.data.length), 'Cache-Control': 'private, no-store',
      'Content-Disposition': `${preview ? 'inline' : 'attachment'}; filename*=UTF-8''${filename}`, 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    if (request.headers.get('x-kadr-form') !== '1' || request.headers.get('sec-fetch-site') === 'cross-site') throw new InputError('Откройте форму в приложении.', 403);
    const route = (await params).command;
    const [collection, key, verb] = route;
    if (route.length === 1 && collection === 'session') {
      const form = await formBody(request, smallRequest);
      const store = getStore();
      const token = (await cookies()).get(sessionCookie)?.value;
      if (field(form, 'mode') === 'logout') {
        store.endSession(token);
        const response = NextResponse.json({ path: '/login' });
        response.cookies.set(sessionCookie, '', { ...sessionOptions, maxAge: 0 });
        return response;
      }
      const demo = field(form, 'demo');
      const person = demo && demoMode() && demoProfiles.some((profile) => String(profile.id) === demo)
        ? store.profile(Number(demo)) : store.authenticate(field(form, 'email').trim().slice(0, 254), field(form, 'password').slice(0, 256));
      if (!person) throw new InputError('Проверьте адрес почты и пароль.', 401);
      store.endSession(token);
      const session = store.startSession(person);
      const response = NextResponse.json({ path: '/board' });
      response.cookies.set(sessionCookie, session.token, { ...sessionOptions, maxAge: session.maxAge });
      return response;
    }

    const person = await currentProfile();
    if (!person) throw new InputError('Сессия завершилась. Войдите снова.', 401);
    if (collection === 'settings' && route.length === 2 && key === 'work-calendar') {
      const form = await formBody(request, smallRequest);
      saveWorkCalendar(getStore(), person, {
        enabled: field(form, 'enabled'), days: field(form, 'days'),
        start: field(form, 'start'), end: field(form, 'end'),
      });
      return NextResponse.json({ path: '/settings' });
    }
    if (collection === 'users' && route.length === 2 && ['edit','deactivate'].includes(key)) {
      const form=await formBody(request,smallRequest),store=getStore(),id=Number(field(form,'id'));
      if(key==='edit')store.editProfile(person,id,{name:field(form,'name'),email:field(form,'email'),role:field(form,'role') as typeof person.role,password:field(form,'password')||undefined});
      else store.deactivateProfile(person,id);
      return NextResponse.json({path:'/settings'});
    }
    if (collection === 'product' && route.length === 2) {
      const form = await formBody(request, smallRequest);
      const result = getStore().productCommand(person, `/api/product/${key}`, Object.fromEntries([...form].map(([name, value]) => [name, String(value)])));
      return NextResponse.json(result);
    }
    if (collection === 'tasks' && route.length === 1) {
      if (person.role !== 'buyer') throw new InputError('Создать задачу может заказчик.', 403);
      const form = await formBody(request, smallRequest);
      const id = getStore().create(person, validateBrief(Object.fromEntries(form), 0), requestId(form));
      return NextResponse.json({ path: `/tasks/${id}` });
    }
    if (collection === 'tasks' && route.length === 3 && ['claim', 'submit', 'revise', 'accept', 'release', 'delete', 'assign'].includes(verb)) {
      const id = positiveId(key);
      const action = verb as Action;
      if (action === 'submit' && person.role !== 'creative') throw new InputError('Сдаёт результат исполнитель.', 403);
      const form = await formBody(request, action === 'submit' ? maxFileBytes * maxFiles + smallRequest : smallRequest);
      const rawVersion = field(form, 'version');
      const version = Number(rawVersion);
      if (!/^\d+$/.test(rawVersion) || !Number.isSafeInteger(version)) throw new InputError('Обновите карточку.');
      if (verb === 'assign') { getStore().assign(person,id,Number(field(form,'creativeId')),version,requestId(form)); return NextResponse.json({path:`/tasks/${id}`}); }
      const usage = action === 'submit' && field(form, 'noAi') !== 'on' ? aiServices.flatMap((service) => {
        if (field(form, `subscription:${service}`) === 'on') return [{service, units:0}];
        const value = field(form, `credit:${service}`).trim();
        return value ? [{ service, units: creditUnits(value) }] : [];
      }) : [];
      if (action === 'submit' && !usage.length && field(form, 'noAi') !== 'on') throw new InputError('Укажите расход или отметьте «Без AI».');
      const files = action === 'submit' ? await uploadFiles(form) : [];
      const store = getStore();
      const operationId = requestId(form);
      const replay = store.atomic(() => {
        const previous = store.db.prepare('SELECT 1 FROM task_events WHERE actorId=? AND requestId=?').get(person.id, operationId);
        store.act(person, id, action, version, operationId, { files, usage, note: field(form, 'note') });
        return Boolean(previous);
      });
      if (!demoMode() && !replay && (action === 'submit' || action === 'revise' || action === 'accept')) {
        const providers = integrationStatus();
        const archive = action === 'accept' && providers.drive ? store.task(person, id)?.submissions[0] : undefined;
        if (providers.telegram || providers.slack || archive) after(async () => {
          const delivery = await deliverTaskUpdate({ taskId: id, action });
          if (delivery.telegram === 'failed' || delivery.slack === 'failed') {
            console.error('Task notification delivery failed', { taskId: id, action, ...delivery });
          }
          if (!archive) return;
          for (const entry of archive.files) {
            const file = store.file(person, entry.id);
            if (!file) continue;
            const result = await archiveDriveFile({ ...file, taskId: id, round: archive.round, fileId: entry.id });
            if (result.status === 'failed') console.error('Drive archival failed', { taskId: id, fileId: entry.id });
          }
        });
      }
      return NextResponse.json({ path: action === 'release' || action === 'delete' ? '/board?task=none' : `/tasks/${id}` });
    }
    throw new InputError('Страница не найдена.', 404);
  } catch (error) { return errorResponse(error); }
}
