import { Studio } from '@/components/studio';
import { notFound, redirect } from 'next/navigation';
import { ReferenceBoard } from '@/components/reference-board';
import { Board } from '@/components/board';
import { AccountMenu, Analytics, Login, NewTask, Settings, TaskDrawer, TaskScreen, Workspace, WorkspaceHistory } from '@/components/screens';
import InkOrbitFeatures from '@/components/ui/ink-orbit-features';
import { demoMode, getStore, requestSnapshot } from '@/lib/data';
import { ProductPage } from '@/components/product';
import { deliveryMetrics } from '@/lib/metrics';
import { InputError, localDay, reportPeriod } from '@/lib/workflow';

type Props = { params: Promise<{ view?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ params, searchParams }: Props) {
  const route = (await params).view ?? [];
  const view = route[0];
  if (view === 'reference') return <ReferenceBoard />;
  const demo = demoMode();
  const { now, person } = await requestSnapshot();
  if (!view) redirect(person ? '/board' : '/login');
  if (view === 'login' && route.length === 1) {
    if (person) redirect('/board');
    return <Login demo={demo} />;
  }
  if (!person) redirect('/login');

  const store = getStore();
  const query = await searchParams;
  const snapshot = store.productSnapshot(person, now);
  const unread = snapshot.notices.filter(item => !item.read).length;
  let screen;
  let active = view;
  if (view === 'studio' && route.length === 1) {
    const taskId = query.task;
    const detail = taskId ? store.task(person, Number(taskId)) : null;
    if (taskId && !detail) notFound();
    else screen = <Studio key={detail?.task.id ?? 'blank'} task={detail?.task} />;
  } else if (view === 'board' && route.length === 1) {
    const mine = query.scope === 'mine' && person.role === 'creative';
    active = mine ? 'mine' : 'board';
    const tasks = store.list(person);
    const selection = typeof query.task === 'string' && /^\d+$/.test(query.task) ? Number(query.task) : null;
    const defaultTask = demo && query.task === undefined && !mine ? tasks.find((task) => task.status === 'review')?.id : null;
    const id = selection ?? defaultTask;
    const detail = id && (!mine || tasks.some((task) => task.id === id && (task.buyerId === person.id || task.creativeId === person.id))) ? store.task(person, id) : null;
    const boardPath = mine ? '/board?scope=mine&' : '/board?';
    screen = <Board key={active} tasks={tasks} person={{ id: person.id, role: person.role }} mine={mine} now={now} selectedId={detail?.task.id}
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
    screen = <ProductPage view={view as 'templates' | 'notifications' | 'integrations'} person={person} snapshot={snapshot} tasks={store.list(person)} now={now} />;
  } else if (view === 'how-it-works' && route.length === 1) {
    screen = <InkOrbitFeatures />;
  } else if (view === 'settings' && route.length === 1) {
    screen = <Settings person={person} />;
  } else if (view === 'history' && route.length === 1 && person.role === 'lead') {
    screen = <WorkspaceHistory events={store.workspaceHistory(person)} />;
  } else if ((view === 'analytics' || view === 'team' || view === 'ai-expenses') && route.length === 1) {
    if (person.role !== 'lead') notFound();
    const start = view !== 'team' && typeof query.from === 'string' ? query.from : localDay(now - 29 * 86_400_000);
    const end = view !== 'team' && typeof query.to === 'string' ? query.to : localDay(now);
    let result = null;
    let issue: string | undefined;
    try { result = store.analytics(person, start, end, now); }
    catch (error) {
      if (!(error instanceof InputError)) throw error;
      issue = error.message;
    }
    const period = !issue ? reportPeriod(start, end) : null;
    const completed = store.list(person).filter(task => task.completedAt !== null && period && task.completedAt >= period.from && task.completedAt < period.to);
    const delivery = deliveryMetrics(completed.map(task => ({ ...task, completedAt: task.completedAt!, rounds: store.task(person, task.id)!.submissions.length })));
    screen = view === 'team' || view === 'ai-expenses'
      ? <><ProductPage view={view} person={person} snapshot={snapshot} tasks={store.list(person)} now={now} usage={result?.usage} />{view === 'ai-expenses' && <Analytics result={result} start={start} end={end} error={issue} section={view} />}</>
      : <Analytics result={result} start={start} end={end} error={issue} section={view} delivery={delivery} />;
  } else notFound();
  return <Workspace person={person} active={active} demo={demo} counts={store.taskCounts(person)} unread={unread}>{screen}</Workspace>;
}
