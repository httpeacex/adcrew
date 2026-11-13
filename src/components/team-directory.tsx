'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, BriefcaseBusiness, Clapperboard, Search, ShieldCheck } from 'lucide-react';
import { Avatar } from './board';
import { formatDate, roles, statuses, type Profile, type Task } from '@/lib/workflow';
import './team-directory.css';

const groups = [
  { role: 'buyer', label: 'Заказчики', Icon: BriefcaseBusiness },
  { role: 'creative', label: 'Креативщики', Icon: Clapperboard },
  { role: 'lead', label: 'Руководители', Icon: ShieldCheck },
] as const;

function MemberAvatar({ member }: { member: Profile }) {
 return <Avatar personId={member.id} initials={member.initials} color={member.color}/>;
}

export function TeamDirectory({ members, tasks, currentId }: { members: Profile[]; tasks: Task[]; currentId: number }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [tab, setTab] = useState<'tasks' | 'profile'>('tasks');
  const [selectedId, setSelectedId] = useState(
    members.find(member => member.id === currentId && member.role !== 'lead')?.id ??
    members.find(member => member.role === 'creative')?.id ?? currentId,
  );
  const detail = useRef<HTMLElement>(null);
  const term = query.trim().toLocaleLowerCase('ru');
  const visible = members.filter(member => (!role || member.role === role) && `${member.name} ${member.email}`.toLocaleLowerCase('ru').includes(term));
  const selected = visible.find(member => member.id === selectedId) ?? visible[0];
  const records = members.map(member => {
    const items = tasks.filter(task => member.role === 'buyer' ? task.buyerId === member.id : task.creativeId === member.id);
    const done = items.filter(task => task.status === 'done').length;
    return { id: member.id, items, done, active: items.length - done };
  });
  const summary = records.find(record => record.id === selected?.id);
  const selectedTasks = summary?.items.toSorted((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.deadline - b.deadline) ?? [];

  function selectMember(id: number) {
    setSelectedId(id);
    setTab('tasks');
    if (matchMedia('(max-width: 860px)').matches) {
      detail.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  }

  return <div className="team-directory">
    <section className="team-roster" aria-label="Участники команды">
      <div className="team-toolbar">
        <label className="team-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Поиск участника" placeholder="Поиск по имени или email" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <select aria-label="Роль участника" value={role} onChange={event => setRole(event.target.value)}><option value="">Все роли</option>{Object.entries(roles).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      </div>
      <div className="team-lanes">
        {groups.filter(group => !role || group.role === role).map(({ role: groupRole, label, Icon }) => {
          const people = visible.filter(member => member.role === groupRole);
          if (!people.length) return null;
          return <section className={`team-lane team-lane-${groupRole}`} aria-label={label} key={groupRole}>
            <h2><Icon size={15} aria-hidden="true" />{label}<span>{people.length}</span></h2>
            <div className="team-lane-cards">{people.map(member => {
              const data = records.find(record => record.id === member.id)!;
              return <button type="button" className="team-member" aria-pressed={selected?.id === member.id} key={member.id} onClick={() => selectMember(member.id)}>
                <span className="team-member-identity"><MemberAvatar member={member} /><span><strong>{member.name}</strong><small>{roles[member.role]}</small><small className="member-email">{member.email}</small></span></span>
                <span className="team-member-stats"><span>Задач <b>{data.items.length}</b></span><span>Активные <b>{data.active}</b></span><span>Готово <b>{data.done}</b></span></span>
              </button>;
            })}</div>
          </section>;
        })}
      </div>
      {!visible.length && <p className="empty-panel" role="status">Участники не найдены. Измените поиск или роль.</p>}
    </section>
    {selected && summary && <aside ref={detail} className={`team-detail team-detail-${selected.role}`} aria-label="Профиль участника">
      <header><MemberAvatar member={selected} /><div><h2>{selected.name}</h2><p>{roles[selected.role]}</p></div></header>
      <div className="team-detail-tabs" role="group" aria-label="Раздел профиля">
        <button type="button" aria-pressed={tab === 'tasks'} onClick={() => setTab('tasks')}>Задачи <span>{summary.items.length}</span></button>
        <button type="button" aria-pressed={tab === 'profile'} onClick={() => setTab('profile')}>Профиль</button>
      </div>
      {tab === 'tasks' ? <section className="team-detail-body" aria-label="Задачи участника">
        <div className="team-detail-counts"><span>Активные <b>{summary.active}</b></span><span>Готово <b>{summary.done}</b></span></div>
        <div className="member-tasks">{selectedTasks.map(task => <Link href={`/board?task=${task.id}`} key={task.id}><span className={`status-pill ${task.status}`}>{statuses.find(status => status.id === task.status)?.label}</span><strong>{task.offer}</strong><small>{formatDate(task.deadline)}<ArrowUpRight size={14} aria-hidden="true" /></small></Link>)}</div>
        {!selectedTasks.length && <p className="team-detail-empty">У участника пока нет задач.</p>}
      </section> : <dl className="team-detail-body team-profile"><div><dt>Роль</dt><dd>{roles[selected.role]}</dd></div><div><dt>Эл. почта</dt><dd>{selected.email}</dd></div></dl>}
    </aside>}
  </div>;
}
