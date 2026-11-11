'use client';
import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search, Users } from 'lucide-react';
import { formatDate, roles, statuses, type Profile, type Task } from '@/lib/workflow';

export function TeamDirectory({ members, tasks, currentId }: { members: Profile[]; tasks: Task[]; currentId: number }) {
  const [query,setQuery] = useState('');
  const [role,setRole] = useState('');
  const [selectedId,setSelectedId] = useState(members.find(member=>member.id===currentId && member.role!=='lead')?.id ?? members.find(member=>member.role==='creative')?.id ?? currentId);
  const selected = members.find(member=>member.id===selectedId) ?? members[0];
  const assigned = (member: Profile) => tasks.filter(task=> member.role==='buyer' ? task.buyerId===member.id : task.creativeId===member.id);
  const stats = (member: Profile) => { const items=assigned(member); const done=items.filter(task=>task.status==='done').length; return {items,done,active:items.length-done,percent:items.length ? Math.round(done/items.length*100) : 0}; };
  const visible = members.filter(member=>(!role || member.role===role) && `${member.name} ${member.email}`.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
  const summary = selected ? stats(selected) : null;
  return <div className="team-directory"><section className="team-roster" aria-label="Участники команды">
    <div className="team-toolbar"><label className="team-search"><Search size={16}/><input type="search" aria-label="Поиск участника" placeholder="Поиск по имени или email" value={query} onChange={event=>setQuery(event.target.value)}/></label><select aria-label="Роль участника" value={role} onChange={event=>setRole(event.target.value)}><option value="">Все роли</option>{Object.entries(roles).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><span className="team-total"><Users size={16}/>{visible.length}</span></div>
    <div className="team-member-grid">{visible.map(member=>{const data=stats(member);return <button type="button" className="team-member" aria-pressed={selected?.id===member.id} key={member.id} onClick={()=>setSelectedId(member.id)}><span className={`avatar ${member.color}`}>{member.initials}</span><strong>{member.name}</strong><span className="member-role">{roles[member.role]}</span><span className="member-email" title={member.email}>{member.email}</span><dl><div><dt>Задачи</dt><dd>{data.items.length}</dd></div><div><dt>Готово</dt><dd>{data.done}</dd></div><div><dt>В работе</dt><dd>{data.active}</dd></div></dl><span className="member-progress-label">Завершено: {data.items.length ? `${data.percent}%` : '—'}</span><span className="member-progress"><i style={{width:`${data.percent}%`}}/></span></button>;})}</div>
    {!visible.length && <p className="empty-panel">Участники не найдены. Измените поиск или роль.</p>}
  </section>{selected && summary && <aside className="team-detail" aria-label="Статистика участника"><header><span className={`avatar ${selected.color}`}>{selected.initials}</span><div><strong>{selected.name}</strong><small>{roles[selected.role]}</small></div></header><h2>Статистика участника</h2><div className="team-donut" style={{'--completion':`${summary.percent}%`} as CSSProperties}><div><span>Завершено задач</span><strong>{summary.items.length ? `${summary.percent}%` : '—'}</strong><small>{summary.done} из {summary.items.length}</small></div></div><p className="team-stat-note">Доля завершённых задач среди назначенных участнику.</p><h2>Задачи</h2><div className="member-tasks">{summary.items.toSorted((a,b)=>Number(a.status==='done')-Number(b.status==='done') || a.deadline-b.deadline).slice(0,4).map(task=><Link href={`/board?task=${task.id}`} key={task.id}><span className={`status-pill ${task.status}`}>{statuses.find(status=>status.id===task.status)?.label}</span><strong>{task.offer}</strong><small>{formatDate(task.deadline)}<ArrowUpRight size={14}/></small></Link>)}{!summary.items.length && <p className="muted">Назначенных задач пока нет.</p>}</div><Link className="button primary" href="/board">К доске задач<ArrowUpRight size={15}/></Link></aside>}</div>;
}
