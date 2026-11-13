import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  actionsFor, aiServices, canRead, InputError, intervals, isOverdue, maxFileBytes, maxFiles, reportPeriod,
  type Action, type Actor, type Brief, type Event, type Profile, type ResultFile, type Status, type Submission, type Task, type Usage,
} from './workflow.ts';

export type Upload = { name: string; type: string; data: Uint8Array };
type Command = { files?: Upload[]; usage?: Usage[]; note?: string };
type TaskRow = Omit<Task, 'references' | 'timing'> & { referenceJson: string };
type PersonRow = Profile & { password: string };
const selectTasks = `SELECT t.*, b.name AS buyerName, c.name AS creativeName, c.initials AS creativeInitials, c.color AS creativeColor,
  (SELECT f.id FROM task_files f WHERE f.submissionId = (SELECT id FROM submissions WHERE taskId = t.id ORDER BY round DESC LIMIT 1)
    AND f.type IN ('image/jpeg','image/png','image/webp') AND length(f.data) <= 307200 ORDER BY f.id DESC LIMIT 1) AS coverId,
  CASE WHEN EXISTS (
    SELECT 1 FROM task_events e WHERE e.taskId = t.id AND e.action = 'submit'
    AND e.round = (SELECT MAX(s.round) FROM submissions s WHERE s.taskId = t.id)
    AND e.requestId IN ('demo-' || (t.id - 1) || '-2', 'demo-' || (t.id - 1) || '-4')
  ) AND EXISTS (
    SELECT 1 FROM metadata WHERE key = 'reference-demo-v1'
  ) THEN t.id - 9 ELSE NULL END AS demoPreview
  FROM tasks t JOIN profiles b ON b.id = t.buyerId LEFT JOIN profiles c ON c.id = t.creativeId`;
const taskScope = { lead: ' WHERE t.deletedAt IS NULL', buyer: ' WHERE t.deletedAt IS NULL AND t.buyerId = ?', creative: ' WHERE t.deletedAt IS NULL' };
const destinations: Record<Action, Status> = { claim: 'progress', submit: 'review', revise: 'revision', accept: 'done', release: 'new', delete: 'new' };
const sessionLife = 8 * 3600_000;

function unpack({ referenceJson, ...row }: TaskRow): Task { return { ...row, references: JSON.parse(referenceJson) }; }
function digest(data: string | Uint8Array) { return createHash('sha256').update(data).digest('hex'); }

export class Store {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path, { timeout: 5_000 });
    this.db.exec(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, initials TEXT NOT NULL,
        color TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('buyer','creative','lead'))
      ) STRICT;
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY, profileId INTEGER NOT NULL REFERENCES profiles(id), expires INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY, offer TEXT NOT NULL, geo TEXT NOT NULL, format TEXT NOT NULL CHECK(format IN ('image','video','animation','other')),
        quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 999), description TEXT NOT NULL, referenceJson TEXT NOT NULL,
        priority TEXT NOT NULL CHECK(priority IN ('low','normal','high','urgent')), deadline INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('new','progress','review','revision','done')), version INTEGER NOT NULL DEFAULT 0,
        buyerId INTEGER NOT NULL REFERENCES profiles(id), creativeId INTEGER REFERENCES profiles(id), createdAt INTEGER NOT NULL,
        claimedAt INTEGER, submittedAt INTEGER, completedAt INTEGER
      ) STRICT;
      CREATE TABLE IF NOT EXISTS task_events (
        id INTEGER PRIMARY KEY, taskId INTEGER NOT NULL REFERENCES tasks(id), actorId INTEGER NOT NULL REFERENCES profiles(id),
        action TEXT NOT NULL CHECK(action IN ('create','claim','submit','revise','accept','release','delete','assign')), fromStatus TEXT, toStatus TEXT NOT NULL,
        at INTEGER NOT NULL, round INTEGER, requestId TEXT NOT NULL, fingerprint TEXT NOT NULL, UNIQUE(actorId, requestId)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS task_events_task ON task_events(taskId,id);
      CREATE INDEX IF NOT EXISTS tasks_status_deadline ON tasks(status,deadline);
      CREATE INDEX IF NOT EXISTS tasks_buyer ON tasks(buyerId);
      CREATE INDEX IF NOT EXISTS tasks_creative ON tasks(creativeId);
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY, taskId INTEGER NOT NULL REFERENCES tasks(id), creativeId INTEGER NOT NULL REFERENCES profiles(id),
        round INTEGER NOT NULL CHECK(round > 0), submittedAt INTEGER NOT NULL, reviewNote TEXT, UNIQUE(taskId, round)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS submissions_date ON submissions(submittedAt);
      CREATE TABLE IF NOT EXISTS task_files (
        id INTEGER PRIMARY KEY, submissionId INTEGER NOT NULL REFERENCES submissions(id), name TEXT NOT NULL, type TEXT NOT NULL,
        data BLOB NOT NULL CHECK(length(data) BETWEEN 1 AND ${maxFileBytes})
      ) STRICT;
      CREATE INDEX IF NOT EXISTS task_files_submission ON task_files(submissionId);
      CREATE TABLE IF NOT EXISTS ai_usage (
        submissionId INTEGER NOT NULL REFERENCES submissions(id), service TEXT NOT NULL,
        units INTEGER NOT NULL CHECK(units >= 0), PRIMARY KEY(submissionId, service)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;`);
    if (!(this.db.prepare('PRAGMA table_info(tasks)').all() as { name: string }[]).some(column => column.name === 'deletedAt')) this.db.exec('ALTER TABLE tasks ADD COLUMN deletedAt INTEGER');
    if (!(this.db.prepare('PRAGMA table_info(profiles)').all() as { name: string }[]).some(column => column.name === 'active')) this.db.exec('ALTER TABLE profiles ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))');
    const eventSchema = String(this.db.prepare("SELECT sql FROM sqlite_master WHERE name='task_events'").get()?.sql);
    if (!eventSchema.includes("'release'")) this.db.exec(`ALTER TABLE task_events RENAME TO task_events_legacy;
      CREATE TABLE task_events (id INTEGER PRIMARY KEY,taskId INTEGER NOT NULL REFERENCES tasks(id),actorId INTEGER NOT NULL REFERENCES profiles(id),action TEXT NOT NULL CHECK(action IN ('create','claim','submit','revise','accept','release','delete','assign')),fromStatus TEXT,toStatus TEXT NOT NULL,at INTEGER NOT NULL,round INTEGER,requestId TEXT NOT NULL,fingerprint TEXT NOT NULL,UNIQUE(actorId,requestId)) STRICT;
      INSERT INTO task_events SELECT * FROM task_events_legacy; DROP TABLE task_events_legacy; CREATE INDEX task_events_task ON task_events(taskId,id);`);
    const usageSchema = String(this.db.prepare("SELECT sql FROM sqlite_master WHERE name='ai_usage'").get()?.sql);
    if (!usageSchema.includes('units >= 0')) this.db.exec(`ALTER TABLE ai_usage RENAME TO ai_usage_legacy;
      CREATE TABLE ai_usage (submissionId INTEGER NOT NULL REFERENCES submissions(id),service TEXT NOT NULL,units INTEGER NOT NULL CHECK(units >= 0),PRIMARY KEY(submissionId,service)) STRICT;
      INSERT INTO ai_usage SELECT * FROM ai_usage_legacy; DROP TABLE ai_usage_legacy;`);
  }

  atomic<T>(operation: () => T): T {
    if (this.db.isTransaction) return operation();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  addProfile(person: Profile, password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
    this.db.prepare('INSERT INTO profiles(id, email, name, initials, color, role, password) VALUES(?,?,?,?,?,?,?)')
      .run(person.id, person.email.toLowerCase(), person.name, person.initials, person.color, person.role, hash);
  }

  profile(id: number) {
    return this.db.prepare('SELECT id, email, name, initials, color, role FROM profiles WHERE id = ? AND active=1').get(id) as Profile | undefined;
  }

  users(actor: Actor) {
    if (actor.role !== 'lead') throw new InputError('Пользователи доступны руководителю.', 403);
    return this.db.prepare('SELECT id,email,name,initials,color,role,active FROM profiles ORDER BY active DESC,name').all().map(row=>({...row})) as (Profile & { active: number })[];
  }

  editProfile(actor: Actor, id: number, input: { name: string; email: string; role: string; password?: string }) {
    if (actor.role !== 'lead') throw new InputError('Изменение пользователей доступно руководителю.', 403);
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 2 || name.length > 80) throw new InputError('Имя — от 2 до 80 символов.', 400, 'name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new InputError('Укажите корректный email.', 400, 'email');
    if (!['buyer', 'creative', 'lead'].includes(input.role)) throw new InputError('Выберите роль.', 400, 'role');
    if (input.password && (input.password.length < 8 || input.password.length > 200)) throw new InputError('Пароль — от 8 до 200 символов.', 400, 'password');
    return this.atomic(() => {
      const person = this.db.prepare('SELECT role,active FROM profiles WHERE id=?').get(id);
      if (!person) throw new InputError('Пользователь не найден.', 404);
      if(input.role !== person.role && this.db.prepare("SELECT id FROM tasks WHERE deletedAt IS NULL AND status<>'done' AND (creativeId=? OR buyerId=?) LIMIT 1").get(id,id)) throw new InputError('Сначала завершите или переназначьте открытые задачи пользователя.',409);
      if (person.active && person.role === 'lead' && input.role !== 'lead' && Number(this.db.prepare("SELECT COUNT(*) AS count FROM profiles WHERE role='lead' AND active=1").get()?.count) <= 1) throw new InputError('В команде должен остаться активный руководитель.', 403);
      if (this.db.prepare('SELECT id FROM profiles WHERE email=? AND id<>?').get(email,id)) throw new InputError('Этот email уже занят.', 409, 'email');
      const initials = name.split(/\s+/).slice(0,2).map(word => word[0]).join('').toUpperCase();
      this.db.prepare('UPDATE profiles SET name=?,email=?,role=?,initials=? WHERE id=?').run(name,email,input.role,initials,id);
      if (input.password) {
        const salt = randomBytes(16).toString('hex');
        this.db.prepare('UPDATE profiles SET password=? WHERE id=?').run(`${salt}:${scryptSync(input.password,salt,64).toString('hex')}`,id);
        this.db.prepare('DELETE FROM sessions WHERE profileId=?').run(id);
      }
      return id;
    });
  }

  deactivateProfile(actor: Actor, id: number) {
    if (actor.role !== 'lead') throw new InputError('Удаление пользователей доступно руководителю.', 403);
    if (actor.id === id) throw new InputError('Нельзя удалить собственный аккаунт.', 403);
    return this.atomic(() => {
      const person = this.db.prepare('SELECT role,active FROM profiles WHERE id=?').get(id);
      if (!person) throw new InputError('Пользователь не найден.', 404);
      if(this.db.prepare("SELECT id FROM tasks WHERE deletedAt IS NULL AND status<>'done' AND (creativeId=? OR buyerId=?) LIMIT 1").get(id,id)) throw new InputError('Сначала завершите или переназначьте открытые задачи пользователя.',409);
      if (person.active && person.role === 'lead' && Number(this.db.prepare("SELECT COUNT(*) AS count FROM profiles WHERE role='lead' AND active=1").get()?.count) <= 1) throw new InputError('В команде должен остаться активный руководитель.', 403);
      this.db.prepare('UPDATE profiles SET active=0 WHERE id=?').run(id);
      this.db.prepare('DELETE FROM sessions WHERE profileId=?').run(id);
      return id;
    });
  }

  authenticate(email: string, password: string) {
    const person = this.db.prepare('SELECT * FROM profiles WHERE email = ? AND active=1').get(email.toLowerCase()) as PersonRow | undefined;
    const [salt, expected] = person?.password.split(':') ?? ['missing-account', '0'.repeat(128)];
    const valid = timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(expected, 'hex'));
    return valid && person ? this.profile(person.id) : undefined;
  }

  startSession(person: Profile, now = Date.now()) {
    if (!this.profile(person.id)) throw new InputError('Аккаунт недоступен.', 403);
    const token = randomBytes(32).toString('hex');
    this.atomic(() => {
      this.db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now);
      this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), person.id, now + sessionLife);
    });
    return { token, maxAge: sessionLife / 1000 };
  }

  session(token: string | undefined, now = Date.now()) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return undefined;
    const session = this.db.prepare('SELECT profileId FROM sessions WHERE token = ? AND expires > ?').get(digest(token), now);
    return session ? this.profile(Number(session.profileId)) : undefined;
  }

  endSession(token: string | undefined) {
    if (token) this.db.prepare('DELETE FROM sessions WHERE token = ?').run(digest(token));
  }

  list(actor: Actor) {
    const order = ` ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,t.deadline,t.id`;
    const args = actor.role === 'buyer' ? [actor.id] : [];
    return (this.db.prepare(selectTasks + taskScope[actor.role] + order).all(...args) as TaskRow[]).map(unpack);
  }

  taskCounts(actor: Actor) {
    const args = actor.role === 'buyer' ? [actor.id] : [];
    return this.db.prepare(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE t.buyerId = ? OR t.creativeId = ?) AS mine
      FROM tasks t${taskScope[actor.role]}`).get(actor.id, actor.id, ...args) as { total: number; mine: number };
  }

  task(actor: Actor, id: number) {
    const row = this.db.prepare(selectTasks + ' WHERE t.id = ? AND t.deletedAt IS NULL').get(id) as TaskRow | undefined;
    if (!row || !canRead(actor, row)) return null;
    const events = this.db.prepare(`SELECT e.id, p.name AS actorName, e.action, e.fromStatus, e.toStatus, e.at, e.round
      FROM task_events e JOIN profiles p ON p.id = e.actorId WHERE e.taskId = ? ORDER BY e.id`).all(id) as Event[];
    const submissions = (this.db.prepare('SELECT id,round,submittedAt,reviewNote FROM submissions WHERE taskId = ? ORDER BY round DESC').all(id) as Omit<Submission, 'files' | 'usage'>[])
      .map((submission) => ({ ...submission,
        files: this.db.prepare('SELECT id,name,type,length(data) AS size FROM task_files WHERE submissionId = ? ORDER BY id').all(submission.id) as ResultFile[],
        usage: this.db.prepare('SELECT service,units FROM ai_usage WHERE submissionId = ? ORDER BY service').all(submission.id) as Usage[],
      }));
    return { task: unpack(row), events, submissions };
  }

  file(actor: Actor, id: number) {
    const scope = this.db.prepare(`SELECT t.buyerId,t.creativeId,t.status FROM task_files f
      JOIN submissions s ON s.id=f.submissionId JOIN tasks t ON t.id=s.taskId WHERE f.id=?`).get(id) as Task | undefined;
    if (!scope || !canRead(actor, scope)) return null;
    return this.db.prepare('SELECT name,type,data FROM task_files WHERE id = ?').get(id) as Upload;
  }

  private replay(actor: Actor, requestId: string, fingerprint: string) {
    const previous = this.db.prepare('SELECT taskId,fingerprint FROM task_events WHERE actorId=? AND requestId=?').get(actor.id, requestId);
    if (!previous) return null;
    if (previous.fingerprint !== fingerprint) throw new InputError('Этот запрос уже использован. Обновите страницу.', 409);
    return Number(previous.taskId);
  }

  create(actor: Actor, brief: Brief, requestId: string, now = Date.now()) {
    if (actor.role !== 'buyer') throw new InputError('Создать задачу может заказчик.', 403);
    if (brief.quantity !== 1) throw new InputError('Одна задача — один самостоятельный креатив.', 400, 'quantity');
    const fingerprint = digest(JSON.stringify(['create', brief]));
    return this.atomic(() => {
      const previous = this.replay(actor, requestId, fingerprint);
      if (previous !== null) return previous;
      if (brief.deadline <= now) throw new InputError('Укажите будущую дату и время.', 400, 'deadline');
      const result = this.db.prepare(`INSERT INTO tasks(offer,geo,format,quantity,description,referenceJson,priority,deadline,status,buyerId,createdAt)
        VALUES(?,?,?,?,?,?,?,?,'new',?,?)`).run(brief.offer, brief.geo, brief.format, brief.quantity, brief.description, JSON.stringify(brief.references), brief.priority, brief.deadline, actor.id, now);
      const taskId = Number(result.lastInsertRowid);
      this.db.prepare("INSERT INTO task_events(taskId,actorId,action,toStatus,at,requestId,fingerprint) VALUES(?,?,'create','new',?,?,?)")
        .run(taskId, actor.id, now, requestId, fingerprint);
      return taskId;
    });
  }

  act(actor: Actor, id: number, action: Action, version: number, requestId: string, command: Command, now = Date.now()) {
    const { files = [], usage = [], note = '' } = command;
    const fingerprint = digest(JSON.stringify([id, action, version, note, usage, files.map((file) => [file.name, file.type, digest(file.data)])]));
    return this.atomic(() => {
      const previous = this.replay(actor, requestId, fingerprint);
      if (previous !== null) return previous;
      const task = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
      if (!task || task.deletedAt) throw new InputError('Задача не найдена.', 404);
      if (action === 'claim' && actor.role === 'creative' && version === 0 && task.version !== version) throw new InputError('Задачу уже взял другой исполнитель. Обновите доску.', 409);
      if (!canRead(actor, task)) throw new InputError('Задача не найдена.', 404);
      if (task.version !== version) throw new InputError('Задача изменилась. Обновите карточку.', 409);
      if (!actionsFor(actor, task).includes(action)) throw new InputError('Действие недоступно в текущем статусе.', 403);

      const at = Math.max(now, task.submittedAt ?? 0, task.claimedAt ?? 0, task.createdAt,
        Number(this.db.prepare('SELECT MAX(at) AS at FROM task_events WHERE taskId=?').get(id)?.at ?? 0));
      const latest = this.db.prepare('SELECT id,round FROM submissions WHERE taskId = ? ORDER BY round DESC LIMIT 1').get(id);
      let round = latest ? Number(latest.round) : null;
      if (action === 'submit') {
        if (files.length < 1 || files.length > maxFiles || files.some((file) => file.data.length < 1 || file.data.length > maxFileBytes)) throw new InputError('Приложите от одного до пяти файлов до 25 МБ каждый.');
        if (new Set(usage.map((item) => item.service)).size !== usage.length || usage.some((item) => !aiServices.some((service) => item.service === service) || !Number.isSafeInteger(item.units) || item.units < 0 || item.units > 9_999_999_999)) {
          throw new InputError('Проверьте сервисы и расход кредитов. Каждый сервис можно указать один раз.');
        }
        round = (round ?? 0) + 1;
        const submission = this.db.prepare('INSERT INTO submissions(taskId,creativeId,round,submittedAt) VALUES(?,?,?,?)').run(id, actor.id, round, at).lastInsertRowid;
        const attach = this.db.prepare('INSERT INTO task_files(submissionId,name,type,data) VALUES(?,?,?,?)');
        for (const file of files) attach.run(submission, file.name, file.type, file.data);
        const spend = this.db.prepare('INSERT INTO ai_usage VALUES(?,?,?)');
        for (const item of usage) spend.run(submission, item.service, item.units);
      } else if (action === 'revise') {
        if (!note.trim() || note.length > 3000) throw new InputError('Укажите, что нужно исправить, до 3000 символов.');
        this.db.prepare('UPDATE submissions SET reviewNote=? WHERE id=?').run(note.trim(), Number(latest?.id));
      }

      if ((action === 'release' || action === 'delete') && this.db.prepare('SELECT 1 FROM submissions WHERE taskId=?').get(id)) throw new InputError('После сдачи результата действие недоступно.', 403);
      const next = action === 'delete' ? task.status : destinations[action];
      this.db.prepare('UPDATE tasks SET status=?, version=version+1, creativeId=?, claimedAt=?, submittedAt=?, completedAt=? WHERE id=?')
        .run(next, action === 'release' ? null : action === 'claim' ? actor.id : task.creativeId, action === 'release' ? null : action === 'claim' ? at : task.claimedAt,
          action === 'submit' ? at : task.submittedAt, action === 'accept' ? at : task.completedAt, id);
      if (action === 'delete') this.db.prepare('UPDATE tasks SET deletedAt=? WHERE id=?').run(at, id);
      this.db.prepare('INSERT INTO task_events(taskId,actorId,action,fromStatus,toStatus,at,round,requestId,fingerprint) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(id, actor.id, action, task.status, next, at, round, requestId, fingerprint);
      return id;
    });
  }

  assign(actor: Actor, id: number, creativeId: number, version: number, requestId: string, now = Date.now()) {
    if (actor.role !== 'lead') throw new InputError('Назначение доступно руководителю.', 403);
    const fingerprint = digest(JSON.stringify([id, 'assign', creativeId, version]));
    return this.atomic(() => {
      const previous = this.replay(actor, requestId, fingerprint);
      if (previous !== null) return previous;
      const task = this.db.prepare('SELECT * FROM tasks WHERE id=? AND deletedAt IS NULL').get(id) as Task | undefined;
      if (!task) throw new InputError('Задача не найдена.', 404);
      if (task.version !== version) throw new InputError('Задача изменилась. Обновите карточку.', 409);
      if (!['new', 'progress'].includes(task.status) || task.submittedAt !== null || this.db.prepare('SELECT 1 FROM submissions WHERE taskId=?').get(id)) throw new InputError('После сдачи назначение недоступно.', 403);
      if (!this.db.prepare("SELECT id FROM profiles WHERE id=? AND role='creative' AND active=1").get(creativeId)) throw new InputError('Выберите креативщика.');
      const at = Math.max(now, task.claimedAt ?? 0, task.createdAt, Number(this.db.prepare('SELECT MAX(at) AS at FROM task_events WHERE taskId=?').get(id)?.at ?? 0));
      this.db.prepare("UPDATE tasks SET creativeId=?,status='progress',claimedAt=?,version=version+1 WHERE id=?").run(creativeId, task.claimedAt ?? at, id);
      this.db.prepare("INSERT INTO task_events(taskId,actorId,action,fromStatus,toStatus,at,requestId,fingerprint) VALUES(?,?,'assign',?,'progress',?,?,?)").run(id,actor.id,task.status,at,requestId,fingerprint);
      return id;
    });
  }

  workspaceHistory(actor: Actor) {
    if (actor.role !== 'lead') throw new InputError('История отдела доступна руководителю.', 403);
    return this.db.prepare(`SELECT e.id,e.taskId,t.offer,p.name AS actorName,e.action,e.fromStatus,e.toStatus,e.at,e.round
      FROM task_events e JOIN tasks t ON t.id=e.taskId JOIN profiles p ON p.id=e.actorId ORDER BY e.at DESC,e.id DESC LIMIT 100`).all() as (Event & { taskId: number; offer: string })[];
  }

  analytics(actor: Actor, start: string, end: string, now = Date.now()) {
    if (actor.role !== 'lead') throw new InputError('Отчёт доступен руководителю.', 403);
    const { from, to } = reportPeriod(start, end);
    const tasks = this.list(actor);
    const within = (time: number) => time >= from && time < to;
    const completed = tasks.filter((task) => task.completedAt !== null && within(task.completedAt));
    const openOverdue = tasks.filter((task) => task.completedAt === null && isOverdue(task, now));
    const lateCompleted = completed.filter((task) => isOverdue(task));
    const rows = this.db.prepare(`SELECT e.taskId,e.toStatus,e.at FROM task_events e JOIN tasks t ON t.id=e.taskId
      WHERE t.completedAt >= ? AND t.completedAt < ? ORDER BY e.taskId,e.id`).all(from, to) as (Pick<Event, 'toStatus' | 'at'> & { taskId: number })[];
    const histories = new Map<number, typeof rows>();
    for (const event of rows) {
      if (!histories.has(event.taskId)) histories.set(event.taskId, []);
      histories.get(event.taskId)!.push(event);
    }
    const total = { cycle: 0, production: 0, review: 0 };
    for (const history of histories.values()) {
      const time = intervals(history);
      total.cycle += time.cycle;
      total.production += time.production;
      total.review += time.review;
    }
    const divide = (value: number) => completed.length ? value / completed.length : null;
    const workload = (this.db.prepare("SELECT id,name,initials,color FROM profiles WHERE role='creative' ORDER BY name").all() as Pick<Profile, 'id' | 'name' | 'initials' | 'color'>[])
      .map((person) => {
        const active = tasks.filter((task) => task.creativeId === person.id);
        return { ...person, progress: active.filter((task) => task.status === 'progress').length,
          revision: active.filter((task) => task.status === 'revision').length, review: active.filter((task) => task.status === 'review').length };
      });
    const usage = this.db.prepare(`SELECT u.service,p.id AS creativeId,p.name AS creativeName,SUM(u.units) AS units,COUNT(*) AS entries FROM ai_usage u
      JOIN submissions s ON s.id=u.submissionId JOIN profiles p ON p.id=s.creativeId WHERE s.submittedAt>=? AND s.submittedAt<?
      GROUP BY u.service,p.id ORDER BY u.service,units DESC,p.name`).all(from, to) as (Usage & { creativeId: number; creativeName: string; entries: number })[];
    return { created: tasks.filter((task) => within(task.createdAt)).length, completed: completed.length, openOverdue, lateCompleted,
      average: { cycle: divide(total.cycle), production: divide(total.production), review: divide(total.review) }, workload, usage };
  }
}
