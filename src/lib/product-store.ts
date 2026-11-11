import { Store } from './store.ts';
import { createHash } from 'node:crypto';
import { aiServices, InputError, intervals, reportPeriod, type Actor, type Brief, type Profile, type Event } from './workflow.ts';

export type Template = {id:number; name:string; creatorId:number; brief:Brief};
export type Comment = {id:number; taskId:number; actorId:number; actorName:string; body:string; round:number|null; at:number};
export type Notice = {id:number; taskId:number|null; title:string; at:number; read:boolean};
export type Rate = {service:string; price:number; currency:'RUB'};
export type Budget = {amount:number; currency:'RUB'};
const text = (value:string|undefined,max=3000) => {const result=(value??'').trim(); if(!result || result.length>max)throw new InputError('Проверьте заполнение поля.'); return result;};
const integer = (value:string|undefined) => {const n=Number(value);if(!value || !Number.isSafeInteger(n)||n<0)throw new InputError('Укажите корректное число.');return n;};
const money = (value:string|undefined,decimals=2) => {const n=Number(value);if(!value?.trim()||!Number.isFinite(n)||n<0||n>1e12)throw new InputError('Укажите корректную сумму.');return Math.round(n*10**decimals)/10**decimals;};
const plain = <T,>(value:T):T => JSON.parse(JSON.stringify(value));

export class ProductStore extends Store {
 constructor(path:string){super(path);this.db.exec(`
 CREATE TABLE IF NOT EXISTS product_templates(id INTEGER PRIMARY KEY,name TEXT NOT NULL,creatorId INTEGER NOT NULL,brief TEXT NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS product_comments(id INTEGER PRIMARY KEY,taskId INTEGER NOT NULL,actorId INTEGER NOT NULL,body TEXT NOT NULL,round INTEGER,at INTEGER NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS product_notices(id INTEGER PRIMARY KEY,recipientId INTEGER NOT NULL,taskId INTEGER,title TEXT NOT NULL,at INTEGER NOT NULL,read INTEGER NOT NULL DEFAULT 0,eventKey TEXT NOT NULL,UNIQUE(recipientId,eventKey)) STRICT;
 CREATE TABLE IF NOT EXISTS product_checks(taskId INTEGER NOT NULL,key TEXT NOT NULL,checked INTEGER NOT NULL,PRIMARY KEY(taskId,key)) STRICT;
 CREATE TABLE IF NOT EXISTS product_rates(service TEXT PRIMARY KEY,price REAL NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS product_budget(id INTEGER PRIMARY KEY,amount REAL NOT NULL) STRICT;
 INSERT OR IGNORE INTO product_budget VALUES(1,0);
 CREATE TABLE IF NOT EXISTS product_assignments(id INTEGER PRIMARY KEY,taskId INTEGER NOT NULL,actorId INTEGER NOT NULL,creativeId INTEGER NOT NULL,fromStatus TEXT NOT NULL,toStatus TEXT NOT NULL,at INTEGER NOT NULL,version INTEGER NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS product_requests(actorId INTEGER NOT NULL,requestId TEXT NOT NULL,fingerprint TEXT NOT NULL,path TEXT NOT NULL,PRIMARY KEY(actorId,requestId)) STRICT;
 `);}
 override profile(id:number){const profile=super.profile(id);return profile?{...profile}:undefined;}
 private members(){return (this.db.prepare('SELECT id,email,name,initials,color,role FROM profiles ORDER BY name').all() as Profile[]).map(row=>({...row}));}
 private readable(actor:Actor,id:number){const detail=super.task(actor,id);if(!detail)throw new InputError('Задача не найдена.',404);return detail;}
 private notice(recipientId:number,taskId:number,title:string,at:number,eventKey:string){this.db.prepare('INSERT OR IGNORE INTO product_notices(recipientId,taskId,title,at,eventKey) VALUES(?,?,?,?,?)').run(recipientId,taskId,title,at,eventKey);}
 private participants(taskId:number){const task=this.db.prepare('SELECT buyerId,creativeId FROM tasks WHERE id=?').get(taskId)!;return [...new Set([Number(task.buyerId),...(task.creativeId?[Number(task.creativeId)]:[]),...this.members().filter(p=>p.role==='lead').map(p=>p.id)])];}
 productSnapshot(actor:Actor,now=Date.now()){
  const members=this.members();
  for(const task of this.list(actor)){
   if(task.status==='done'||(actor.role!=='lead'&&task.buyerId!==actor.id&&task.creativeId!==actor.id))continue;
   const left=task.deadline-now;
   if(left<=86400000){const overdue=left<0;this.notice(actor.id,task.id,`${overdue?'Просрочен дедлайн':'Дедлайн в течение суток'}: ${task.offer}`,overdue?task.deadline:Math.max(task.createdAt,task.deadline-86400000),`deadline:${task.id}:${task.deadline}:${overdue?'overdue':'soon'}`);}
  }
  const templates=(this.db.prepare('SELECT * FROM product_templates WHERE creatorId=? ORDER BY id DESC').all(actor.id) as {id:number;name:string;creatorId:number;brief:string}[]).map(t=>({...t,brief:JSON.parse(t.brief) as Brief}));
  const notices=(this.db.prepare('SELECT id,taskId,title,at,read FROM product_notices WHERE recipientId=? ORDER BY at DESC,id DESC').all(actor.id) as (Omit<Notice,'read'>&{read:number})[]).filter(n=>n.taskId===null||!!super.task(actor,n.taskId)).map(n=>({...n,read:!!n.read}));
  const rates=(this.db.prepare('SELECT * FROM product_rates ORDER BY service').all() as {service:string;price:number}[]).map(r=>({...r,currency:'RUB' as const}));
  const budget:Budget={amount:Number(this.db.prepare('SELECT amount FROM product_budget WHERE id=1').get()!.amount),currency:'RUB'};
  const month=new Date(now+5*3600000).toISOString().slice(0,7);const from=Date.parse(`${month}-01T00:00:00+05:00`);const end=new Date(from+5*3600000);end.setUTCMonth(end.getUTCMonth()+1);const to=end.getTime()-5*3600000;
  const rows=this.db.prepare('SELECT s.taskId,u.service,u.units FROM ai_usage u JOIN submissions s ON s.id=u.submissionId WHERE s.submittedAt>=? AND s.submittedAt<?').all(from,to) as {taskId:number;service:string;units:number}[];
  let spent=0,unpricedUnits=0;for(const row of rows){if(!super.task(actor,row.taskId))continue;const rate=rates.find(r=>r.service===row.service);if(rate)spent+=row.units/1000*rate.price;else unpricedUnits+=row.units;}
  return {members,templates,notices,rates,budget,metrics:{spent:Math.round(spent*100)/100,unpricedUnits,remaining:Math.round((budget.amount-spent)*100)/100}};
 }
 taskExtras(actor:Actor,id:number){this.readable(actor,id);const comments=this.db.prepare('SELECT c.*,p.name AS actorName FROM product_comments c JOIN profiles p ON p.id=c.actorId WHERE taskId=? ORDER BY c.id').all(id) as Comment[];const checks={brief:false,format:false,quality:false};for(const row of this.db.prepare('SELECT key,checked FROM product_checks WHERE taskId=?').all(id)){if(row.key==='brief'||row.key==='format'||row.key==='quality')checks[row.key]=!!row.checked;}return plain({comments,checks,members:this.members().filter(member=>!!super.task(member,id)),assignable:actor.role==='lead'?this.members().filter(member=>member.role==='creative'):[]});}
 override act(...args:Parameters<Store['act']>){return this.atomic(()=>{const replayed=!!this.db.prepare('SELECT 1 FROM task_events WHERE actorId=? AND requestId=?').get(args[0].id,args[4]);const result=super.act(...args);if(args[2]==='submit'&&!replayed)this.db.prepare('DELETE FROM product_checks WHERE taskId=?').run(args[1]);const [actor,id,action,,, ,now=Date.now()]=args;const event=this.db.prepare('SELECT id,at FROM task_events WHERE actorId=? AND requestId=?').get(actor.id,args[4])!;for(const recipient of this.participants(id)){if(recipient!==actor.id)this.notice(recipient,id,({claim:'Задача взята в работу',submit:'Результат на проверке',revise:'Запрошены правки',accept:'Работа принята'})[action],Number(event.at??now),`event:${event.id}`);}return result;});}
 override task(actor:Actor,id:number){const detail=super.task(actor,id);if(!detail)return null;const assigned=this.db.prepare("SELECT -a.id AS id,p.name AS actorName,'assign' AS action,a.fromStatus,a.toStatus,a.at,NULL AS round FROM product_assignments a JOIN profiles p ON p.id=a.actorId WHERE taskId=? ORDER BY a.id").all(id) as Event[];return plain({...detail,events:[...detail.events,...assigned].sort((a,b)=>a.at-b.at)});}
 override workspaceHistory(actor:Actor){const events=super.workspaceHistory(actor);const assignments=this.db.prepare("SELECT -a.id AS id,a.taskId,t.offer,p.name AS actorName,'assign' AS action,a.fromStatus,a.toStatus,a.at,NULL AS round FROM product_assignments a JOIN tasks t ON t.id=a.taskId JOIN profiles p ON p.id=a.actorId").all() as (Event&{taskId:number;offer:string})[];return [...events,...assignments].sort((a,b)=>b.at-a.at).slice(0,100);}
 override analytics(actor:Actor,start:string,end:string,now=Date.now()){
  const result=super.analytics(actor,start,end,now),{from,to}=reportPeriod(start,end);
  const completed=this.list(actor).filter(t=>t.completedAt!==null&&t.completedAt>=from&&t.completedAt<to);
  const total={cycle:0,production:0,review:0};
  for(const task of completed){const times=intervals(this.task(actor,task.id)!.events);total.cycle+=times.cycle;total.production+=times.production;total.review+=times.review;}
  return plain({...result,average:{cycle:completed.length?total.cycle/completed.length:null,production:completed.length?total.production/completed.length:null,review:completed.length?total.review/completed.length:null}});
 }
 productCommand(actor:Actor,route:string,fields:Record<string,string>,now=Date.now()):{path:string}{return this.atomic(()=>{
  if(!fields.requestId)return this.executeProductCommand(actor,route,fields,now);
  const requestId=text(fields.requestId,200);
  const fingerprint=createHash('sha256').update(JSON.stringify([route,Object.entries(fields).filter(([key])=>key!=='requestId').sort(([a],[b])=>a.localeCompare(b))])).digest('hex');
  const prior=this.db.prepare('SELECT fingerprint,path FROM product_requests WHERE actorId=? AND requestId=?').get(actor.id,requestId);
  if(prior){if(prior.fingerprint!==fingerprint)throw new InputError('Запрос уже использован. Обновите страницу.',409);return {path:String(prior.path)};}
  const result=this.executeProductCommand(actor,route,fields,now);
  this.db.prepare('INSERT INTO product_requests VALUES(?,?,?,?)').run(actor.id,requestId,fingerprint,result.path);
  return result;
 });}
 private executeProductCommand(actor:Actor,route:string,fields:Record<string,string>,now:number):{path:string}{return this.atomic(()=>{
  const lead=()=>{if(actor.role!=='lead')throw new InputError('Действие доступно руководителю.',403);};
  if(route==='/api/product/read'){if(fields.noticeId)this.db.prepare('UPDATE product_notices SET read=1 WHERE id=? AND recipientId=?').run(integer(fields.noticeId),actor.id);else this.db.prepare('UPDATE product_notices SET read=1 WHERE recipientId=?').run(actor.id);return {path:'/notifications'};}
  if(route==='/api/product/member'){lead();const name=text(fields.name,100),email=text(fields.email,254).toLowerCase(),role=fields.role as Profile['role'],password=text(fields.password,256);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['buyer','creative','lead'].includes(role)||password.length<8)throw new InputError('Проверьте email, роль и пароль (от 8 символов).');if(this.db.prepare('SELECT id FROM profiles WHERE email=?').get(email))throw new InputError('Email уже используется.',409);const id=Number(this.db.prepare('SELECT COALESCE(MAX(id),0)+1 AS id FROM profiles').get()!.id);this.addProfile({id,name,email,role,initials:name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(),color:'violet'},password);return {path:'/team'};}
  if(route==='/api/product/rate'){lead();if(!aiServices.some(s=>s===fields.service)||(fields.currency&&fields.currency!=='RUB'))throw new InputError('Проверьте сервис и валюту RUB.');this.db.prepare('INSERT INTO product_rates VALUES(?,?) ON CONFLICT(service) DO UPDATE SET price=excluded.price').run(fields.service,money(fields.price,6));return {path:'/ai-expenses'};}
  if(route==='/api/product/budget'){lead();this.db.prepare('UPDATE product_budget SET amount=? WHERE id=1').run(money(fields.amount));return {path:'/ai-expenses'};}
  const id=integer(fields.taskId),detail=this.readable(actor,id),task=detail.task;
  if(route==='/api/product/comment'){const body=text(fields.body);const round=fields.round?integer(fields.round):null;if(round!==null&&!detail.submissions.some(s=>s.round===round))throw new InputError('Раунд не найден.');const mentioned=(fields.mentionIds??'').split(',').filter(Boolean).map(s=>integer(s.trim()));for(const memberId of mentioned){const member=this.profile(memberId);if(!member||!super.task(member,id))throw new InputError('Участник не имеет доступа к задаче.');}const result=this.db.prepare('INSERT INTO product_comments(taskId,actorId,body,round,at) VALUES(?,?,?,?,?)').run(id,actor.id,body,round,now);for(const recipient of new Set([...this.participants(id),...mentioned])){if(recipient!==actor.id)this.notice(recipient,id,`Комментарий: ${body.slice(0,120)}`,now,`comment:${result.lastInsertRowid}`);}}
  else if(route==='/api/product/check'){if(actor.role!=='lead'&&(actor.role!=='buyer'||task.buyerId!==actor.id))throw new InputError('Чек-лист доступен покупателю и руководителю.',403);if(!['brief','format','quality'].includes(fields.key)||!['true','false','1','0','on','off'].includes(fields.checked))throw new InputError('Проверьте пункт чек-листа.');this.db.prepare('INSERT INTO product_checks VALUES(?,?,?) ON CONFLICT(taskId,key) DO UPDATE SET checked=excluded.checked').run(id,fields.key,['true','1','on'].includes(fields.checked)?1:0);}
  else if(route==='/api/product/template'||route==='/api/product/duplicate'){if(actor.role!=='buyer'||task.buyerId!==actor.id)throw new InputError('Выберите собственную задачу покупателя.',403);if(route.endsWith('/duplicate'))return {path:`/tasks/new?source=${id}`};const {offer,geo,format,quantity,description,references,priority,deadline}=task;this.db.prepare('INSERT INTO product_templates(name,creatorId,brief) VALUES(?,?,?)').run(text(fields.name,100),actor.id,JSON.stringify({offer,geo,format,quantity,description,references,priority,deadline}));return {path:'/templates'};}
  else if(route==='/api/product/assign'){lead();if(task.version!==integer(fields.version))throw new InputError('Задача изменилась. Обновите карточку.',409);if(!['new','progress','revision'].includes(task.status))throw new InputError('Назначение недоступно в текущем статусе.',403);const creative=this.profile(integer(fields.creativeId));if(creative?.role!=='creative')throw new InputError('Выберите креативщика.');const status=task.status==='new'?'progress':task.status;this.db.prepare('UPDATE tasks SET creativeId=?,status=?,claimedAt=COALESCE(claimedAt,?),version=version+1 WHERE id=?').run(creative.id,status,now,id);const a=this.db.prepare('INSERT INTO product_assignments(taskId,actorId,creativeId,fromStatus,toStatus,at,version) VALUES(?,?,?,?,?,?,?)').run(id,actor.id,creative.id,task.status,status,now,task.version+1);for(const recipient of new Set([...this.participants(id),...(task.creativeId?[task.creativeId]:[])])){if(recipient!==actor.id)this.notice(recipient,id,`Назначен исполнитель: ${creative.name}`,now,`assignment:${a.lastInsertRowid}`);}}
  else throw new InputError('Действие не найдено.',404);
  return {path:`/tasks/${id}`};
 });}
}


