import Link from 'next/link';
import Image from 'next/image';
import { fileHref } from '@/lib/client-runtime';
import { Bell, FileText, Puzzle, ArrowDownToLine, ArrowUpRight, BarChart3, BookOpen, CalendarDays, Check, MoreVertical, ClipboardList, Clock3, Columns3, FileImage, Film, Flag, History, Layers3, ListTodo, LogOut, Play, Plus, Settings2, Sparkles, Users } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { demoProfiles } from '@/lib/demo-profiles';
import type { Store } from '@/lib/store';
import type { ProductStore } from '@/lib/product-store';
import { TaskCollaboration } from './product';
import { VersionComparison } from './version-comparison';
import { deliveryMetrics } from '@/lib/metrics';
import { actionsFor, actionLabels, duration, formatCredits, formatDate, formats, intervals, isOverdue, priorities, roles, statuses, zoneLabel, type Event, type Profile, type Submission, type Task } from '@/lib/workflow';
import { Avatar, FormatMark } from './board';
import { BriefForm, SessionForm, TaskAction } from './forms';
import { ThemeSelector, ThemeToggle } from './theme';
import { DemoLogin, LoginCredentials } from './login-controls';
import loginStyles from './login.module.css';

function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true" /><strong>AdCrew</strong></div>;
}

export function AccountMenu({ person, demo }: { person: Profile; demo: boolean }) {
  return <details className="profile-menu">
    <summary aria-label={`Учётная запись: ${person.name}, ${roles[person.role]}`} title={person.name}><Avatar initials={person.initials} color={person.color} /><span><strong>{person.name}</strong><small>{roles[person.role]}</small></span><MoreVertical size={16} /></summary>
    <div className="profile-popup">
      {demo && <><span className="side-caption">Переключить учётку</span><SessionForm className="account-switch">{demoProfiles.map((account) => <button key={account.id} name="demo" value={account.id} disabled={person.id === account.id}>
        <Avatar initials={account.initials} color={account.color} size="tiny" /><span><strong>{account.name}</strong><small>{roles[account.role]}</small></span>{person.id === account.id && <Check size={15} />}
      </button>)}</SessionForm></>}
      <Link href="/how-it-works" className="account-help"><BookOpen size={16} /> Как это работает</Link>
      <SessionForm><button className="logout" name="mode" value="logout"><LogOut size={16} /> Выйти</button></SessionForm>
    </div>
  </details>;
}

const sectionNames: Record<string, string> = { analytics: 'Аналитика', team: 'Команда', 'ai-expenses': 'AI-расходы', history: 'История действий', settings: 'Настройки', 'how-it-works': 'Как это работает', notifications: 'Уведомления', templates: 'Шаблоны', integrations: 'Интеграции' };

export function Workspace({ children, person, active, demo, counts, unread = 0 }: { children: ReactNode; person: Profile; active: string; demo: boolean; counts: ReturnType<Store['taskCounts']>; unread?: number }) {
  const isBoard = active === 'board' || active === 'mine';
  const boardActive = active === 'board' || active === 'task' || active === 'new';
  return <div className={`workspace${isBoard ? ' board-workspace' : ''}`}>
    <a href="#workspace-main" className="skip">К рабочей области</a>
    <aside className={`sidebar${isBoard ? ' board-sidebar' : ''}`}>
      <Link href="/board" className="brand-link" aria-label="AdCrew, доска задач"><Brand /></Link>
      <nav className="side-nav" aria-label="Рабочее пространство">
        <div className="side-group">
          <p className="side-group-title">Работа</p>
          <Link className={boardActive ? 'active' : ''} aria-label="Доска задач" aria-describedby="side-all-count" title="Доска задач" aria-current={active === 'board' ? 'page' : undefined} href="/board"><Columns3 size={18} /><span>Доска задач</span><span className="side-count" id="side-all-count">{counts.total}</span></Link>
          {person.role === 'creative' && <Link className={active === 'mine' ? 'active' : ''} aria-label="Мои задачи" aria-describedby="side-mine-count" title="Мои задачи" aria-current={active === 'mine' ? 'page' : undefined} href="/board?scope=mine"><ListTodo size={18} /><span>Мои задачи</span><span className="side-count" id="side-mine-count">{counts.mine}</span></Link>}
          {person.role === 'lead' && <>
            <Link className={active === 'analytics' ? 'active' : ''} aria-label="Аналитика" title="Аналитика" aria-current={active === 'analytics' ? 'page' : undefined} href="/analytics"><BarChart3 size={18} /><span>Аналитика</span></Link>
            <Link href="/team" className={active === 'team' ? 'active' : ''} aria-current={active === 'team' ? 'page' : undefined} aria-label="Команда" title="Команда"><Users size={18} /><span>Команда</span></Link>
            <Link href="/ai-expenses" className={active === 'ai-expenses' ? 'active' : ''} aria-current={active === 'ai-expenses' ? 'page' : undefined} aria-label="AI-расходы" title="AI-расходы"><Layers3 size={18} /><span>AI-расходы</span></Link>
          </>}
          {(person.role === 'buyer' || person.role === 'lead') && <Link href="/templates" className={active === 'templates' ? 'active' : ''} aria-current={active === 'templates' ? 'page' : undefined} aria-label="Шаблоны"><FileText size={18} /><span>Шаблоны ТЗ</span></Link>}
          <Link href="/integrations" className={active === 'integrations' ? 'active' : ''} aria-current={active === 'integrations' ? 'page' : undefined} aria-label="Интеграции"><Puzzle size={18} /><span>Интеграции</span></Link>
        </div>
        <div className="side-group side-group-system">
          <p className="side-group-title">Система</p>
          <Link href="/notifications" className={active === 'notifications' ? 'active' : ''} aria-current={active === 'notifications' ? 'page' : undefined} aria-label="Уведомления"><span className="sidebar-bell"><Bell size={18} />{unread > 0 && <i />}</span><span>Уведомления</span>{unread > 0 && <span className="side-count">{unread}</span>}</Link>
          {person.role === 'lead' && <Link href="/history" className={active === 'history' ? 'active' : ''} aria-current={active === 'history' ? 'page' : undefined} aria-label="История действий" title="История действий"><History size={18} /><span>История действий</span></Link>}
          <Link href="/settings" className={active === 'settings' ? 'active' : ''} aria-current={active === 'settings' ? 'page' : undefined} aria-label="Настройки" title="Настройки"><Settings2 size={18} /><span>Настройки</span></Link>
        </div>
      </nav>
      <div className="sidebar-promo">
        <span className="sidebar-promo-label">Новое</span>
        <strong>Создавай креативы быстрее в одной системе</strong>
        <Link href={person.role === 'buyer' ? '/tasks/new' : '/how-it-works'} className="sidebar-promo-link">Попробовать <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>
      <div className="sidebar-theme"><ThemeSelector /></div>
      <div className="sidebar-account"><AccountMenu person={person} demo={demo} /></div>
    </aside>
    <div className="workspace-body">
      <main className="workspace-main" id="workspace-main" tabIndex={-1}>
        {isBoard ? children : <div className="workspace-page" data-view={active}>
          {sectionNames[active] && !['templates', 'notifications', 'team', 'ai-expenses', 'integrations'].includes(active) && <h1 className="workspace-title">{sectionNames[active]}</h1>}
          {children}
        </div>}
      </main>
    </div>
  </div>;
}

export function Settings({ person }: { person: Profile }) {
  return <section className="panel"><div className="panel-title"><h2>Учётная запись</h2></div><dl className="facts"><div><dt>Имя</dt><dd>{person.name}</dd></div><div><dt>Роль</dt><dd>{roles[person.role]}</dd></div><div><dt>Электронная почта</dt><dd>{person.email}</dd></div></dl></section>;
}

export function WorkspaceHistory({ events }: { events: ReturnType<Store['workspaceHistory']> }) {
  return <div className="activity-page"><p className="section-description">Последние 100 событий по задачам отдела</p><ol className="activity-log">{events.map(event => {
    const Icon = event.action === 'accept' ? Check : event.action === 'submit' ? FileText : event.action === 'revise' ? History : event.action === 'create' ? Plus : Users;
    return <li key={event.id}><span className={`activity-icon ${event.toStatus}`}><Icon size={16}/></span><div className="activity-content"><header><span className="avatar tiny">{event.actorName.split(' ').map(word=>word[0]).slice(0,2).join('')}</span><strong>{event.actorName}</strong><span>{actionLabels[event.action]}</span><time dateTime={new Date(event.at).toISOString()}>{formatDate(event.at,true)}</time></header><Link className="activity-task" href={`/board?task=${event.taskId}`}><span><small>КР-{String(event.taskId).padStart(3,'0')}{event.round ? ` · Версия ${event.round}` : ''}</small><strong>{event.offer}</strong></span><span className={`status-pill ${event.toStatus}`}>{statuses.find(status=>status.id===event.toStatus)?.label}</span><ArrowUpRight size={16}/></Link></div></li>;
  })}</ol>{!events.length && <p className="empty-panel">Событий пока нет.</p>}</div>;
}

export function Login({ demo }: { demo: boolean }) {
  const steps = [
    { title: 'Выберите роль', text: 'Покупатель, креативщик или руководитель — подстроим AdCrew под ваши задачи.', Icon: Users },
    { title: 'Настройте рабочее пространство', text: 'Соберите команду и управляйте задачами креативного отдела.', Icon: Layers3 },
    { title: 'Запустите задачи', text: 'Заказывайте креативы, управляйте работой и получайте результат в одном сервисе.', Icon: Play },
  ];
  return <main className={loginStyles.page}>
    <div className={loginStyles.shell}>
      <section className={loginStyles.intro} aria-labelledby="login-welcome">
        <div className={loginStyles.brand}><Brand /></div>
        <div className={loginStyles.introCopy}>
          <h1 id="login-welcome">Начните работу<br />с AdCrew</h1>
          <p>Единое пространство для креативных задач,<br className={loginStyles.desktopBreak} /> команды и рекламных проектов.</p>
          <ol className={loginStyles.steps}>{steps.map(({ title, text, Icon }, index) => <li key={title}>
            <span className={loginStyles.stepIcon}><Icon size={25} strokeWidth={1.7} aria-hidden="true" /></span>
            <div><h2>{title}</h2><p>{text}</p></div><span className={loginStyles.stepNumber} aria-hidden="true">0{index + 1}</span>
          </li>)}</ol>
          <div className={loginStyles.pagination} aria-hidden="true"><i /><i /><i /></div>
        </div>
      </section>
      <section className={loginStyles.formPanel} aria-labelledby="login-title">
        <div className={loginStyles.theme}><ThemeToggle /></div>
        <div className={loginStyles.formContent}>
          <h2 id="login-title">Войти в аккаунт</h2>
          <p className={loginStyles.formDescription}>Продолжите работу с вашей командой в AdCrew.</p>
          <LoginCredentials />
          {demo && <><div className={loginStyles.divider}><span>Или познакомьтесь с сервисом</span></div><DemoLogin /></>}
          <p className={loginStyles.formFooter}>Креативы, команда и результаты в одном месте.</p>
        </div>
      </section>
    </div>
  </main>;
}

export function NewTask({ initial }: { initial?: Task | import('@/lib/workflow').Brief } = {}) {
  return <>
    <div className="page-title"><div><div className="section-label"><ClipboardList size={16} /> Постановка задачи</div><h1>Новое ТЗ</h1><p>Опишите оффер, объём и результат, который нужен.</p></div></div>
    {initial && <p className="prefill-note">Бриф заполнен из сохранённой задачи или шаблона. Проверьте требования и задайте новый дедлайн.</p>}
    <BriefForm key={initial?.offer ?? 'new'} initial={initial} />
  </>;
}

export function TaskScreen({ task, events, submissions, person, now, extras }: { task: Task; events: Event[]; submissions: Submission[]; person: Profile; now: number; extras?: ReturnType<ProductStore['taskExtras']> }) {
  const actions = actionsFor(person, task);
  const state = statuses.find((status) => status.id === task.status)!;
  const time = task.completedAt ? intervals(events) : null;
  return <>
    <div className="page-title detail-title"><div><div className="section-label"><FormatMark format={task.format} /> КР-{String(task.id).padStart(3, '0')} / {formats[task.format]}</div><h1>{task.offer}</h1></div><span className={`status-pill ${state.id}`}><span className={`status-dot ${state.id}`} /> {state.label}</span></div>
    <div className="detail-grid">
      <div className="detail-main">
        <VersionComparison submissions={submissions} />
        <section className="panel"><div className="panel-title"><ClipboardList size={20} /><h2>Техническое задание</h2></div>
          <dl className="brief-meta"><div><dt>GEO</dt><dd><span className="geo-tag">{task.geo}</span></dd></div><div><dt>Формат</dt><dd>{formats[task.format]}</dd></div><div><dt>Количество</dt><dd>{task.quantity} шт.</dd></div><div><dt>Приоритет</dt><dd className={`priority ${task.priority}`}><Flag size={14} /> {priorities[task.priority]}</dd></div></dl>
          <p className="brief-description">{task.description}</p>
          <div className="references"><h3>Референсы</h3>{task.references.length ? <ul>{task.references.map((url, index) => <li key={`${index}-${url}`}><a href={url} target="_blank" rel="noopener noreferrer">{url} <ArrowUpRight size={15} /></a></li>)}</ul> : <p>Ссылок пока нет.</p>}</div>
        </section>
        {actions.includes('submit') && <section className="panel action-panel"><div className="panel-title"><Plus size={20} /><h2>Сдача результата</h2></div><p className="muted">Файлы и расход только за текущий раунд.</p>{task.status === 'revision' && submissions[0]?.reviewNote && <div className="revision-note"><strong>Что нужно исправить</strong><p>{submissions[0].reviewNote}</p></div>}<TaskAction task={task.id} version={task.version} action="submit" /></section>}
        <section className="panel"><div className="panel-title"><Layers3 size={20} /><h2>Результаты</h2><span className="panel-count">{submissions.length}</span></div>
          {submissions.length === 0 && <div className="empty-panel">Здесь появятся файлы после первой сдачи.</div>}
          {submissions.map((submission) => <article className="submission" key={submission.id}>
            <div className="submission-title"><div><h3>Версия {submission.round}</h3><span>{formatDate(submission.submittedAt, true)}</span></div>{task.status === 'done' && submissions[0].id === submission.id && <span className="accepted"><Check size={15} /> Принято</span>}</div>
            {submission.files[0] && <div className="submission-preview">{submission.files[0].type.startsWith('image/')
              ? <Image unoptimized fill loading="lazy" src={fileHref(submission.files[0].id, true)} alt={`Предпросмотр ${submission.files[0].name}`} />
              : <video controls preload="none" aria-label={`Предпросмотр ${submission.files[0].name}`} src={fileHref(submission.files[0].id, true)} />}</div>}
            <div className="result-files">{submission.files.map((file) => <div className="result-file" key={file.id}>
              <a href={fileHref(file.id, true)} target="_blank" rel="noreferrer" className="file-preview">{file.type === 'video/mp4' ? <Film size={19} /> : <FileImage size={19} />}<span>{file.name}<small>{new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(Math.max(0.1, file.size / 1024))} КБ</small></span><ArrowUpRight size={15} /></a>
              <a className="file-download" download={file.name} href={fileHref(file.id)} aria-label={`Скачать ${file.name}`}><ArrowDownToLine size={18} /></a>
            </div>)}</div>
            {submission.reviewNote && <div className="revision-note"><strong>Комментарий к правкам</strong><p>{submission.reviewNote}</p></div>}
            <div className="usage-tags"><Sparkles size={15} />{submission.usage.length ? submission.usage.map((item) => <span key={item.service}>{item.service} · {formatCredits(item.units)} кр.</span>) : <span>Без AI</span>}</div>
          </article>)}
        </section>
      </div>
      <div className="detail-aside">
        {extras && <TaskCollaboration person={person} task={task} extras={extras} returnTo={`/tasks/${task.id}`} rounds={submissions.map(item => item.round)} />}
        <section className="panel"><div className="panel-title"><CalendarDays size={19} /><h2>Сроки и команда</h2></div>
          <dl className="facts"><div><dt>Дедлайн</dt><dd className={isOverdue(task, now) ? 'late' : ''}>{formatDate(task.deadline, true)} {isOverdue(task, now) && <small>Просрочено</small>}</dd></div><div><dt>Покупатель</dt><dd>{task.buyerName}</dd></div><div><dt>Исполнитель</dt><dd>{task.creativeName ?? 'Свободна'}</dd></div>{time && <><div><dt>Полный цикл</dt><dd>{duration(time.cycle)}</dd></div><div><dt>В производстве</dt><dd>{duration(time.production)}</dd></div><div><dt>На проверке</dt><dd>{duration(time.review)}</dd></div></>}</dl>
          {actions.some((action) => action !== 'submit') && <div className="task-actions">{actions.filter((action) => action !== 'submit').toReversed().map((action) => <TaskAction task={task.id} version={task.version} action={action} key={action} />)}</div>}
        </section>
        <section className="panel"><div className="panel-title"><History size={19} /><h2>История задачи</h2></div>
          <ol className="timeline">{events.toReversed().map((event) => <li key={event.id}><span className={`status-dot ${event.toStatus}`} /><div><strong>{actionLabels[event.action]}{event.round && (event.action === 'submit' || event.action === 'revise') ? ` · v${event.round}` : ''}</strong><small>{event.actorName} · {formatDate(event.at, true)}</small></div></li>)}</ol>
        </section>
      </div>
    </div>
  </>;
}

export { TaskInspector as TaskDrawer } from './task-inspector';

type Report = ReturnType<Store['analytics']>;

function AnalyticsOverview({ result }: { result: Report }) {
  const byService = new Map<string, number>();
  for (const item of result.usage) byService.set(item.service, (byService.get(item.service) ?? 0) + item.units);
  const services = [...byService].sort((a, b) => a[0].localeCompare(b[0]));
  const totalOpen = result.workload.reduce((n,item)=>n+item.progress+item.revision+item.review,0);
  const review = result.workload.reduce((n,item)=>n+item.review,0);
  const loadMax = Math.max(1,...result.workload.map(item=>item.progress+item.revision+item.review));
  return <section className="analytics-overview" aria-labelledby="analytics-overview-title">
    <div className="analytics-hero"><h2 id="analytics-overview-title" className="overview-title">Производство в цифрах</h2><p className="overview-caption">Результаты команды за выбранный период</p>
    <dl className="overview-metrics">{[
      { label: 'Создано за период', value: result.created, Icon: Layers3 },
      { label: 'Завершено за период', value: result.completed, Icon: Check },
      { label: 'Средний цикл', value: duration(result.average.cycle), Icon: Clock3 },
      { label: 'Открытые просрочки', value: result.openOverdue.length, Icon: Flag },
      { label: 'AI-сервисов', value: services.length, Icon: Sparkles },
    ].map(({ label, value, Icon }) => <div className="overview-metric metric-tile" key={label}><i className="metric-icon" aria-hidden="true"><Icon size={16} /></i><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
    <div className="overview-graphs"><section><h3>Задачи на проверке</h3><p className="overview-caption">Среди текущих задач команды</p><div className="team-donut" style={{'--completion': `${totalOpen ? review/totalOpen*100 : 0}%`} as CSSProperties}><div><span>На проверке</span><strong>{review}</strong><small>из {totalOpen} открытых</small></div></div></section><section><h3>Загрузка команды</h3><p className="overview-caption">Текущие незавершённые задачи</p><div className="analytics-bars">{result.workload.map(item=><div key={item.id}><strong>{item.progress+item.revision+item.review}</strong><i style={{height:`${(item.progress+item.revision+item.review)/loadMax*115}px`}}/><span title={item.name}>{item.name.split(' ')[0]}</span></div>)}</div></section><section><h3>AI-расходы по сервисам</h3><p className="overview-caption">Кредиты учитываются отдельно: единицы разных сервисов имеют разную стоимость.</p>
      {services.length ? <ul className="service-credit-list">{services.map(([service, units]) => <li key={service}><Sparkles size={16} /><span>{service}</span><strong>{formatCredits(units)} кр.</strong></li>)}</ul> : <p className="muted">За период расходов нет.</p>}
    </section></div>
  </section>;
}

function ReportTeam({ workload }: { workload: Report['workload'] }) {
  const maximum = Math.max(1, ...workload.map((item) => item.progress + item.revision + item.review));
  return <section className="panel" id="team"><div className="panel-title"><Users size={19} /><h2>Загрузка команды</h2></div><p className="muted">Текущие незавершённые задачи по исполнителям.</p>
    <div className="legend"><span><i className="status-dot progress" /> В работе</span><span><i className="status-dot revision" /> Правки</span><span><i className="status-dot review" /> На проверке</span></div>
    <div className="workload">{workload.map((item) => <div className="workload-row" key={item.id}><Avatar initials={item.initials} color={item.color} /><div><strong>{item.name}</strong><div className="load-bar" aria-label={`В работе ${item.progress}, правки ${item.revision}, на проверке ${item.review}`}>{(['progress', 'revision', 'review'] as const).map((status) => item[status] > 0 && <span key={status} className={status} style={{ width: `${item[status] * 100 / maximum}%` }} />)}</div></div><b>{item.progress + item.revision + item.review}</b></div>)}</div>
  </section>;
}

function CreditReport({ usage }: { usage: Report['usage'] }) {
  return <section className="panel" id="ai-usage"><div className="panel-title"><Sparkles size={19} /><h2>AI-кредиты</h2></div><p className="muted">За все сдачи в выбранном периоде, включая повторные.</p>
    <div className="report-table"><table><thead><tr><th>Сервис</th><th>Исполнитель</th><th className="numeric">Кредиты</th></tr></thead><tbody>{usage.map((item) => <tr key={`${item.service}-${item.creativeId}`}><td>{item.service}</td><td>{item.creativeName}</td><td className="numeric">{formatCredits(item.units)}</td></tr>)}</tbody></table>{!usage.length && <p className="empty-panel">Расходов за выбранный период нет.</p>}</div>
  </section>;
}

function OverdueReport({ result }: { result: Report }) {
  const groups = [{ label: 'Открытые сейчас', rows: result.openOverdue }, { label: 'Приняты с опозданием', rows: result.lateCompleted }];
  return <section className="panel"><div className="panel-title"><Flag size={19} /><h2>Просрочки</h2></div>
    <div className="report-overdue">{groups.map(({ label, rows }) => <section key={label} className="overdue-group">
      <header><h3>{label}</h3><b>{rows.length}</b></header>
      {rows.length ? <ul>{rows.toSorted((a, b) => a.deadline - b.deadline).map((task) => <li key={task.id}><Link href={`/tasks/${task.id}`}><strong>{task.offer}</strong><span><time dateTime={new Date(task.deadline).toISOString()}>{formatDate(task.deadline, true)}</time><ArrowUpRight size={15} /></span></Link></li>)}</ul> : <p className="muted">Нет просроченных задач.</p>}
    </section>)}</div>
  </section>;
}

export function Analytics({ result, start, end, error, section, delivery }: { result: Report | null; start: string; end: string; error?: string; section: 'analytics' | 'team' | 'ai-expenses'; delivery?: ReturnType<typeof deliveryMetrics> }) {
  const descriptions = { analytics: 'Сроки производства, загрузка команды и AI-расходы', team: 'Текущая загрузка креативщиков', 'ai-expenses': 'Расход по сервисам и исполнителям за выбранный период' };
  return <div className="analytics-page">
    <p className="section-description">{descriptions[section]}</p>
    {section !== 'team' && <form className="report-range" action={`/${section}`} aria-label="Период отчёта">
      <label><span>Начало периода</span><input type="date" name="from" defaultValue={start} required /></label>
      <label><span>Конец периода</span><input type="date" name="to" defaultValue={end} required /></label>
      <button className="button primary" type="submit">Показать</button><span className="report-zone">{zoneLabel}</span>
    </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {result && <>
      {section === 'team' && <ReportTeam workload={result.workload} />}
      {section === 'ai-expenses' && <CreditReport usage={result.usage} />}
      {section === 'analytics' && <>
        <AnalyticsOverview result={result} />
        {delivery && <section className="delivery-summary panel" aria-label="Качество производства"><h2>Качество производства</h2><p className="muted">По {delivery.count} принятым задачам за выбранный период</p><dl>{[
          ['Принято с первого раза', delivery.firstPass === null ? '—' : `${Math.round(delivery.firstPass)}%`],
          ['Принято в срок', delivery.onTime === null ? '—' : `${Math.round(delivery.onTime)}%`],
          ['Раундов правок на задачу', delivery.revisions === null ? '—' : delivery.revisions.toLocaleString('ru', { maximumFractionDigits: 1 })],
          ['Утверждено материалов', delivery.materials],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
        <div className="report-grid"><ReportTeam workload={result.workload} /><section className="panel"><div className="panel-title"><Clock3 size={19} /><h2>Среднее время</h2></div><p className="muted">По задачам, принятым за период.</p><dl className="facts report-facts"><div><dt>Полный цикл</dt><dd>{duration(result.average.cycle)}</dd></div><div><dt>В работе и на правках</dt><dd>{duration(result.average.production)}</dd></div><div><dt>На проверке</dt><dd>{duration(result.average.review)}</dd></div></dl></section></div>
        <CreditReport usage={result.usage} />
        <OverdueReport result={result} />
      </>}
    </>}
  </div>;
}
