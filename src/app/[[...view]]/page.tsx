import { integrationStatus } from '@/lib/integration-server';
import { readReportTasks, withTaskTimes, type RevisionEvent } from '@/lib/operations-report';
import { readWorkCalendar } from '@/lib/work-calendar';
import { WorkCalendarSettings } from '@/components/work-calendar-settings';
import { UserManagement } from '@/components/users';
import { OperationsAnalytics } from '@/components/operations-analytics';
import { FinancePage, FinanceSettings } from '@/components/finance';
import { Library } from '@/components/library';
import { Dashboard } from '@/components/dashboard';
import { Landing } from '@/components/landing';
import { Studio } from '@/components/studio';
import { notFound, redirect } from 'next/navigation';
import { ReferenceBoard } from '@/components/reference-board';
import { Board } from '@/components/board';
import { AccountMenu, NewTask, Settings, TaskDrawer, TaskScreen, Workspace, WorkspaceHistory } from '@/components/screens';
import InkOrbitFeatures from '@/components/ui/ink-orbit-features';
import { demoMode, getStore, requestSnapshot } from '@/lib/data';
import { ProductPage } from '@/components/product';
import { InputError, libraryTaskId, localDay, reportPeriod, workspaceEntry } from '@/lib/workflow';

type Props = { params: Promise<{ view?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ params, searchParams }: Props) {
  const route = (await params).view ?? [];
  const view = route[0];
  if (view === 'reference') return <ReferenceBoard />;
  const demo = demoMode();
  const { now, person } = await requestSnapshot();
  if (!view) return <Landing demo={demo} signedIn={!!person} />;
  if (view === 'login' && route.length === 1) {
    if (person) redirect(workspaceEntry(person.role));
    return <Landing demo={demo} />;
  }
  if (!person) redirect('/login');

  const store = getStore();
  const query = await searchParams;
  const snapshot = store.productSnapshot(person, now);
  const unread = snapshot.notices.filter(item => !item.read).length;
  const calendar = readWorkCalendar(store);
  const timedTasks = withTaskTimes(store,person,store.list(person),now,calendar);
  let screen;
  let active = view;
  if (view === 'library') {
    const id = libraryTaskId(timedTasks, person, query.task);
    const detail = id ? store.task(person, id) : null;
    screen = <Library tasks={timedTasks} person={person} selected={detail?.task} taskPanel={detail && <TaskDrawer
      {...detail} person={person} now={now} closeHref="/library" currentHref={`/library?task=${detail.task.id}`}
      initialTab="result" extras={store.taskExtras(person, detail.task.id)} />} />;
  } else if (view === 'dashboard') {
    screen = <Dashboard tasks={timedTasks} person={person} now={now} finance={snapshot.finance} />;
  } else if (view === 'studio' && route.length === 1) {
    const taskId = query.task;
    const detail = taskId ? store.task(person, Number(taskId)) : null;
    if (taskId && !detail) notFound();
    else screen = <Studio key={detail?.task.id ?? 'blank'} task={detail?.task} />;
  } else if (view === 'board' && route.length === 1) {
    const mine = query.scope === 'mine' && person.role === 'creative';
    active = mine ? 'mine' : 'board';
    const search = (typeof query.q === 'string' ? query.q : '').trim().toLocaleLowerCase('ru');
    const tasks = search ? timedTasks.filter(task => `${task.offer} КР-${String(task.id).padStart(3, '0')}`.toLocaleLowerCase('ru').includes(search)) : timedTasks;
    const selection = typeof query.task === 'string' && /^\d+$/.test(query.task) ? Number(query.task) : null;
    const defaultTask = demo && query.task === undefined && !mine ? tasks.find((task) => task.status === 'review')?.id : null;
    const id = selection ?? defaultTask;
    const detail = id && (!mine || tasks.some((task) => task.id === id && (task.buyerId === person.id || task.creativeId === person.id))) ? store.task(person, id) : null;
    const boardStatus = typeof query.status === 'string' ? query.status : '';
    const boardPath = `${mine ? '/board?scope=mine&' : '/board?'}${search ? `q=${encodeURIComponent(search)}&` : ''}${boardStatus ? `status=${encodeURIComponent(boardStatus)}&` : ''}`;
    screen = <Board search={search} tariffs={snapshot.finance.tariffs} initialStatus={typeof query.status === 'string' ? query.status : ''} key={`${active}:${boardStatus}:${search}`} tasks={tasks} person={{ id: person.id, role: person.role }} mine={mine} now={now} selectedId={detail?.task.id}
      defaultDrawer={!!defaultTask} account={<AccountMenu person={person} demo={demo} />}
      unread={unread} drawer={detail && <TaskDrawer extras={store.taskExtras(person, detail.task.id)} key={detail.task.id} {...detail} person={person} now={now} closeHref={`${boardPath}task=none`} currentHref={`${boardPath}task=${detail.task.id}`} />} />;
  } else if (view === 'tasks' && route.length === 2) {
    if (route[1] === 'new') {
      if (person.role !== 'buyer') notFound();
      active = 'new';
      const source = typeof query.source === 'string' ? store.task(person, Number(query.source))?.task : undefined;
      const template = snapshot.templates.find(item => String(item.id) === query.template);
      screen = <NewTask initial={source ?? template?.brief} />;
    } else {
      const id = Number(route[1]);
      if (!Number.isSafeInteger(id) || id < 1 || String(id) !== route[1]) notFound();
      const detail = store.task(person, id);
      if (!detail) notFound();
      active = 'task';
      screen = <TaskScreen extras={store.taskExtras(person, id)} {...detail} person={person} now={now} />;
    }
  } else if (['templates', 'notifications', 'integrations'].includes(view) && route.length === 1) {
    if (view === 'templates' && person.role === 'creative') notFound();
    screen = <ProductPage integrationStatus={view === 'integrations' && !demo ? integrationStatus() : undefined} view={view as 'templates' | 'notifications' | 'integrations'} person={person} snapshot={snapshot} tasks={timedTasks} now={now} />;
  } else if (view === 'how-it-works' && route.length === 1) {
    screen = <InkOrbitFeatures />;
  } else if (view === 'settings' && route.length === 1) {
    screen = <><Settings person={person} /><UserManagement person={person} users={person.role === 'lead' ? store.users(person) : []} />{person.role === 'lead' && <WorkCalendarSettings calendar={calendar}/>}<FinanceSettings snapshot={snapshot} person={person} /></>;
  } else if (view === 'history' && route.length === 1 && person.role === 'lead') {
    screen = <WorkspaceHistory events={store.workspaceHistory(person)} />;
  } else if ((view === 'analytics' || view === 'team' || view === 'ai-expenses') && route.length === 1) {
    if (person.role !== 'lead') notFound();
    const start = view !== 'team' && typeof query.from === 'string' ? query.from : `${localDay(now).slice(0,7)}-01`;
    const end = view !== 'team' && typeof query.to === 'string' ? query.to : localDay(now);

    let issue: string | undefined;
    try { reportPeriod(start,end); }
    catch (error) {
      if (!(error instanceof InputError)) throw error;
      issue = error.message;
    }
    const period = !issue ? reportPeriod(start, end) : null;
    screen = view === 'team'
      ? <ProductPage view="team" person={person} snapshot={snapshot} tasks={timedTasks} now={now} />
      : view === 'ai-expenses' ? <FinancePage person={person} snapshot={snapshot} report={period ? store.financeReport(person,period.from,period.to) : undefined} />
      : period ? <OperationsAnalytics members={store.users(person)} tasks={readReportTasks(store,person)} calendar={calendar} events={store.db.prepare('SELECT taskId,action,at,toStatus FROM task_events ORDER BY id').all().map(row=>({...row})) as RevisionEvent[]} snapshot={snapshot} finance={store.financeReport(person,period.from,period.to)} person={person} start={start} end={end} now={now} tab={(typeof query.tab === 'string' ? query.tab : null) || 'overview'} /> : <p role="alert">Проверьте даты периода.</p>;
  } else notFound();
  return <Workspace person={person} active={active} demo={demo} counts={store.taskCounts(person)} unread={unread}>{screen}</Workspace>;
}
