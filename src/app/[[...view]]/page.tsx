import { notFound, redirect } from 'next/navigation';
import { Board } from '@/components/board';
import { AccountMenu, Analytics, Login, NewTask, Settings, TaskDrawer, TaskScreen, Workspace, WorkspaceHistory } from '@/components/screens';
import InkOrbitFeatures from '@/components/ui/ink-orbit-features';
import { demoMode, getStore, requestSnapshot } from '@/lib/data';
import { InputError, localDay } from '@/lib/workflow';

type Props = { params: Promise<{ view?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ params, searchParams }: Props) {
  const route = (await params).view ?? [];
  const view = route[0];
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
  let screen;
  let active = view;
  if (view === 'board' && route.length === 1) {
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
      drawer={detail && <TaskDrawer key={detail.task.id} {...detail} person={person} now={now} closeHref={`${boardPath}task=none`} currentHref={`${boardPath}task=${detail.task.id}`} />} />;
  } else if (view === 'tasks' && route.length === 2) {
    if (route[1] === 'new') {
      if (person.role !== 'buyer') notFound();
      active = 'new';
      screen = <NewTask />;
    } else {
      const id = Number(route[1]);
      if (!Number.isSafeInteger(id) || id < 1 || String(id) !== route[1]) notFound();
      const detail = store.task(person, id);
      if (!detail) notFound();
      active = 'task';
      screen = <TaskScreen {...detail} person={person} now={now} />;
    }
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
    screen = <Analytics result={result} start={start} end={end} error={issue} section={view} />;
  } else notFound();
  return <Workspace person={person} active={active} demo={demo} counts={store.taskCounts(person)}>{screen}</Workspace>;
}
