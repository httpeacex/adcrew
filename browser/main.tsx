import { withTaskTimes } from '@/lib/operations-report';
import { UserManagement } from '@/components/users';
import { OperationsAnalytics } from '@/components/operations-analytics';
import { FinancePage, FinanceSettings } from '@/components/finance';
import { Library } from '@/components/library';
import { Dashboard } from '@/components/dashboard';
import { Landing } from '@/components/landing';
import { Studio } from '@/components/studio';
import { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReferenceBoard } from '@/components/reference-board';
import { Board } from '@/components/board';
import { AccountMenu, NewTask, Settings, TaskDrawer, TaskScreen, Workspace, WorkspaceHistory } from '@/components/screens';
import InkOrbitFeatures from '@/components/ui/ink-orbit-features';
import { ThemeProvider, type Theme } from '@/components/theme';
import { setBrowserRuntime } from '@/lib/client-runtime';
import { ProductPage } from '@/components/product';
import { InputError, localDay, reportPeriod } from '@/lib/workflow';
import { changes, currentProfile, fileUrl, getStore, initializeStore, post, refreshStore } from './local-api';
import { navigate } from './link';
import { withDatabaseLock } from './storage';
import '@/app/globals.css';

setBrowserRuntime({ post, navigate, file: fileUrl });
const initialTheme: Theme = document.cookie.split('; ').includes('kadr_theme=dark') ? 'dark' : 'light';
document.documentElement.dataset.theme = initialTheme;

function Missing() { return <section className="panel"><h1>Страница не найдена</h1><p><a href="#/board">Вернуться к доске задач</a></p></section>; }

function App() {
  const [snapshot, setSnapshot] = useState(() => ({ hash: location.hash, now: Date.now() }));
  useEffect(() => {
    const update = () => setSnapshot({ hash: location.hash, now: Date.now() });
    const changed = async () => { await withDatabaseLock(refreshStore); update(); };
    window.addEventListener('hashchange', update);
    changes.addEventListener('message', changed);
    return () => { window.removeEventListener('hashchange', update); changes.removeEventListener('message', changed); };
  }, []);
  const route = new URL(snapshot.hash.slice(1) || '/', 'https://adcrew.local');
  if (route.pathname === '/reference') return <ReferenceBoard />;
  const person = currentProfile();
  if (!person || route.pathname === '/') return <Landing demo signedIn={!!person} />;
  const store = getStore();
  const path = route.pathname.split('/').filter(Boolean);
  const view = path[0] === 'login' ? 'board' : path[0];
  const now = snapshot.now;
  const product = store.productSnapshot(person, now);
  const unread = product.notices.filter(item => !item.read).length;
  const timedTasks = withTaskTimes(store,person,store.list(person),now);
  let active = view;
  let screen: ReactNode;
  if (view === 'library') {
    screen = <Library tasks={timedTasks} person={person} />;
  } else if (view === 'dashboard') {
    screen = <Dashboard tasks={timedTasks} person={person} now={now} finance={product.finance} />;
  } else if (view === 'studio' && path.length === 1) {
    const taskId = route.searchParams.get('task');
    const detail = taskId ? store.task(person, Number(taskId)) : null;
    if (taskId && !detail) screen = <Missing />;
    else screen = <Studio key={detail?.task.id ?? 'blank'} task={detail?.task} />;
  } else if (view === 'board' && path.length === 1) {
    const mine = route.searchParams.get('scope') === 'mine' && person.role === 'creative';
    active = mine ? 'mine' : 'board';
    const tasks = timedTasks;
    const query = route.searchParams.get('task');
    const defaultTask = query === null && !mine ? tasks.find(task => task.status === 'review')?.id : undefined;
    const id = query && /^\d+$/.test(query) ? Number(query) : defaultTask;
    const detail = id && (!mine || tasks.some(task => task.id === id && task.creativeId === person.id)) ? store.task(person, id) : null;
    const boardStatus = route.searchParams.get('status') || '';
    const boardPath = `${mine ? '/board?scope=mine&' : '/board?'}${boardStatus ? `status=${encodeURIComponent(boardStatus)}&` : ''}`;
    screen = <Board tariffs={product.finance.tariffs} initialStatus={route.searchParams.get('status') || ''} key={`${person.id}:${active}:${route.searchParams.get('status') || ''}`} tasks={tasks} person={person} mine={mine} now={now} selectedId={detail?.task.id}
      defaultDrawer={!!defaultTask} account={<AccountMenu person={person} demo />}
      unread={unread} drawer={detail && <TaskDrawer extras={store.taskExtras(person, detail.task.id)} key={detail.task.id} {...detail} person={person} now={now} closeHref={`${boardPath}task=none`} currentHref={`${boardPath}task=${detail.task.id}`} />} />;
  } else if (view === 'tasks' && path.length === 2) {
    if (path[1] === 'new' && person.role === 'buyer') { active = 'new'; const source = store.task(person, Number(route.searchParams.get('source')))?.task; const template = product.templates.find(item => String(item.id) === route.searchParams.get('template')); screen = <NewTask initial={source ?? template?.brief} />; }
    else {
      const detail = /^\d+$/.test(path[1]) ? store.task(person, Number(path[1])) : null;
      active = 'task';
      screen = detail ? <TaskScreen extras={store.taskExtras(person, detail.task.id)} key={`${person.id}:${detail.task.id}:${detail.task.version}`} {...detail} person={person} now={now} /> : <Missing />;
    }
  } else if (['templates', 'notifications', 'integrations'].includes(view) && path.length === 1 && (view !== 'templates' || person.role !== 'creative')) screen = <ProductPage view={view as 'templates' | 'notifications' | 'integrations'} person={person} snapshot={product} tasks={timedTasks} now={now} />;
  else if (view === 'settings') screen = <><Settings person={person} /><UserManagement person={person} users={person.role === 'lead' ? store.users(person) : []} /><FinanceSettings snapshot={product} person={person} /></>;
  else if (view === 'how-it-works') screen = <InkOrbitFeatures />;
  else if (view === 'history' && person.role === 'lead') screen = <WorkspaceHistory events={store.workspaceHistory(person)} />;
  else if ((view === 'analytics' || view === 'team' || view === 'ai-expenses') && person.role === 'lead') {
    const start = route.searchParams.get('from') || `${localDay(now).slice(0,7)}-01`;
    const end = route.searchParams.get('to') || localDay(now);

    let error: string | undefined;
    try { reportPeriod(start,end); }
    catch (issue) { if (issue instanceof InputError) error = issue.message; else throw issue; }
    const period = !error ? reportPeriod(start, end) : null;
    screen = view === 'team'
      ? <ProductPage view="team" person={person} snapshot={product} tasks={timedTasks} now={now} />
      : view === 'ai-expenses' ? <FinancePage person={person} snapshot={product} report={period ? store.financeReport(person,period.from,period.to) : undefined} />
      : period ? <OperationsAnalytics members={store.users(person)} tasks={timedTasks} events={store.db.prepare('SELECT taskId,action,at FROM task_events ORDER BY id').all() as {taskId:number;action:string;at:number}[]} snapshot={product} finance={store.financeReport(person,period.from,period.to)} person={person} start={start} end={end} now={now} tab={route.searchParams.get('tab') || 'overview'} /> : <p role="alert">Проверьте даты периода.</p>;
  } else screen = <Missing />;
  return <Workspace key={person.id} person={person} active={active} demo counts={store.taskCounts(person)} unread={unread}>{screen}</Workspace>;
}

// Native GET forms need hash routing too; React action forms prevent their own default.
document.addEventListener('submit', event => {
  const form = event.target;
  if (event.defaultPrevented || !(form instanceof HTMLFormElement) || !form.matches('.report-range')) return;
  event.preventDefault();
  const query = new URLSearchParams();
  for (const [name, value] of new FormData(form)) query.set(name, String(value));
  navigate(`${new URL(form.action).pathname}?${query}`);
});
document.addEventListener('click', event => {
  const anchor = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
  const target = anchor?.getAttribute('href');
  if (!target || target.startsWith('#/')) return;
  const element = document.getElementById(target.slice(1));
  if (element) { event.preventDefault(); element.scrollIntoView(); if (element instanceof HTMLElement) element.focus({ preventScroll: true }); }
});

initializeStore().then(() => {
  createRoot(document.getElementById('root')!).render(<ThemeProvider initialTheme={initialTheme}><App /></ThemeProvider>);
}).catch(() => {
  const root = document.getElementById('root')!;
  root.textContent = 'Не удалось открыть демо. Разрешите хранение данных для этого сайта и обновите страницу.';
  root.setAttribute('role', 'alert');
});
