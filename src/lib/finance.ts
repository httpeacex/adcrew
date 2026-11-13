import type { DatabaseSync } from 'node:sqlite';
import { aiServices, InputError, type Actor } from './workflow.ts';
export type Tariff = {service:string;kind:'credits'|'subscription';price:number;credits:number|null;unitPrice:number|null;currency:'USD';updatedAt:number};
export type Expense = {submissionId:number;taskId:number;creativeId:number;creativeName:string;service:string;units:number;round:number;submittedAt:number;kind:string;cost:number|null;unitPrice:number|null};
const round=(n:number)=>Math.round((n+Number.EPSILON)*1e6)/1e6;
const validMoney=(value:string|undefined)=>{if(!value?.trim())throw new InputError('Укажите сумму в USD.');const n=Number(value);if(!Number.isFinite(n)||n<0||n>1e9)throw new InputError('Проверьте сумму в USD.');return round(n);};
export class FinanceLedger {
 private db:DatabaseSync;
 constructor(db:DatabaseSync){this.db=db;db.exec(`
 CREATE TABLE IF NOT EXISTS usd_tariffs(service TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('credits','subscription')),price REAL NOT NULL,credits REAL,updatedAt INTEGER NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS usd_budget(id INTEGER PRIMARY KEY,amount REAL NOT NULL) STRICT;
 INSERT OR IGNORE INTO usd_budget VALUES(1,0);
 CREATE TABLE IF NOT EXISTS usd_costs(submissionId INTEGER NOT NULL,service TEXT NOT NULL,kind TEXT NOT NULL,unitPrice REAL,cost REAL,PRIMARY KEY(submissionId,service)) STRICT;
 CREATE TABLE IF NOT EXISTS usd_subscription_charges(id INTEGER PRIMARY KEY,service TEXT NOT NULL,amount REAL NOT NULL,at INTEGER NOT NULL,actorId INTEGER NOT NULL,note TEXT NOT NULL) STRICT;
 `);}
 tariffs():Tariff[]{return this.db.prepare('SELECT * FROM usd_tariffs ORDER BY service').all().map(r=>({service:String(r.service),kind:r.kind as Tariff['kind'],price:Number(r.price),credits:r.credits===null?null:Number(r.credits),unitPrice:r.kind==='credits'?Number(r.price)/Number(r.credits):null,currency:'USD',updatedAt:Number(r.updatedAt)}));}
 command(actor:Actor,route:string,fields:Record<string,string>,now:number){
  if(!['/api/product/usd-tariff','/api/product/usd-budget','/api/product/usd-charge'].includes(route))return false;
  if(actor.role!=='lead')throw new InputError('Действие доступно руководителю.',403);
  if(route.endsWith('usd-budget')){this.db.prepare('UPDATE usd_budget SET amount=? WHERE id=1').run(validMoney(fields.amount));return true;}
  if(!aiServices.some(s=>s===fields.service))throw new InputError('Выберите AI-сервис.');
  if(route.endsWith('usd-charge')){
   if(!this.tariffs().some(t=>t.service===fields.service&&t.kind==='subscription'))throw new InputError('Выберите подписку без кредитов.');
   const note=(fields.note??'').trim();if(!note||note.length>1000)throw new InputError('Укажите основание платежа.');
   this.db.prepare('INSERT INTO usd_subscription_charges(service,amount,at,actorId,note) VALUES(?,?,?,?,?)').run(fields.service,validMoney(fields.amount),now,actor.id,note);return true;
  }
  if(fields.kind!=='credits'&&fields.kind!=='subscription')throw new InputError('Выберите вид тарифа.');
  const credits=fields.kind==='credits'?Number(fields.credits):null;
  if(fields.kind==='credits'&&(!fields.credits?.trim()||!Number.isFinite(credits)||(credits??0)<=0||(credits??0)>1e12))throw new InputError('Количество кредитов должно быть больше нуля.');
  this.db.prepare('INSERT INTO usd_tariffs VALUES(?,?,?,?,?) ON CONFLICT(service) DO UPDATE SET kind=excluded.kind,price=excluded.price,credits=excluded.credits,updatedAt=excluded.updatedAt').run(fields.service,fields.kind,validMoney(fields.price),credits,now);return true;
 }
 validateUsage(usage:{service:string;units:number}[]){for(const u of usage){const tariff=this.tariffs().find(t=>t.service===u.service);if(u.units===0&&tariff?.kind!=='subscription')throw new InputError('Нулевой расход доступен только подписке без кредитов.');if(tariff?.kind==='subscription'&&u.units!==0)throw new InputError('Для подписки без кредитов отметьте использование без ввода кредитов.');}}
 capture(submissionId:number){for(const row of this.db.prepare('SELECT service,units FROM ai_usage WHERE submissionId=?').all(submissionId)){const tariff=this.tariffs().find(t=>t.service===row.service),unitPrice=tariff?.unitPrice??null;this.db.prepare('INSERT OR IGNORE INTO usd_costs VALUES(?,?,?,?,?)').run(submissionId,String(row.service),tariff?.kind??'unknown',unitPrice,unitPrice===null?null:round(Number(row.units)/1000*unitPrice));}}
 report(actor:Actor,from:number,to:number){
  const scope=actor.role==='lead'?'':actor.role==='buyer'?' AND t.buyerId=?':' AND s.creativeId=?';
  const expenses=this.db.prepare(`SELECT s.id AS submissionId,s.taskId,s.creativeId,p.name AS creativeName,u.service,u.units,s.round,s.submittedAt,COALESCE(c.kind,'legacy') AS kind,c.cost,c.unitPrice FROM ai_usage u JOIN submissions s ON s.id=u.submissionId JOIN tasks t ON t.id=s.taskId JOIN profiles p ON p.id=s.creativeId LEFT JOIN usd_costs c ON c.submissionId=s.id AND c.service=u.service WHERE s.submittedAt>=? AND s.submittedAt<?${scope} ORDER BY s.submittedAt DESC,s.id DESC,u.service`).all(from,to,...(actor.role==='lead'?[]:[actor.id])).map(r=>({...r})) as Expense[];
  const charges=actor.role==='lead'?this.db.prepare('SELECT * FROM usd_subscription_charges WHERE at>=? AND at<? ORDER BY at DESC,id DESC').all(from,to).map(r=>({id:Number(r.id),service:String(r.service),amount:Number(r.amount),at:Number(r.at),note:String(r.note)})):[];
  const allocated=round(expenses.reduce((sum,e)=>sum+(e.cost??0),0)),subscriptionSpent=round(charges.reduce((n,c)=>n+c.amount,0)),spent=round(allocated+subscriptionSpent);
  const services=Array.from(new Set([...expenses.map(e=>e.service),...charges.map(c=>c.service)])).map(service=>({service,spent:round(expenses.filter(e=>e.service===service).reduce((sum,e)=>sum+(e.cost??0),0)+charges.filter(c=>c.service===service).reduce((n,c)=>n+c.amount,0)),unallocated:expenses.filter(e=>e.service===service&&e.cost===null).length}));
  const employees=Array.from(new Set(expenses.map(e=>e.creativeId))).map(creativeId=>({creativeId,name:expenses.find(e=>e.creativeId===creativeId)!.creativeName,spent:round(expenses.filter(e=>e.creativeId===creativeId).reduce((sum,e)=>sum+(e.cost??0),0)),unallocated:expenses.filter(e=>e.creativeId===creativeId&&e.cost===null).length}));
  const taskCount=Number(this.db.prepare(`SELECT COUNT(DISTINCT s.taskId) AS count FROM submissions s JOIN tasks t ON t.id=s.taskId WHERE s.submittedAt>=? AND s.submittedAt<?${scope}`).get(from,to,...(actor.role==='lead'?[]:[actor.id]))!.count);
  return {currency:'USD' as const,from,to,spent,allocated,subscriptionSpent,revisionSpent:round(expenses.filter(e=>e.round>1).reduce((sum,e)=>sum+(e.cost??0),0)),averageCost:taskCount&&!expenses.some(e=>e.cost===null)&&!charges.length?round(allocated/taskCount):null,unknown:expenses.filter(e=>e.cost===null&&e.kind!=='subscription').length,unallocated:expenses.filter(e=>e.kind==='subscription').length,expenses,charges,services,employees};
 }
 snapshot(actor:Actor,now:number){const day=new Date(now+5*3600000).toISOString().slice(0,10),month=day.slice(0,7),from=Date.parse(`${month}-01T00:00:00+05:00`),startToday=Date.parse(`${day}T00:00:00+05:00`);const monthly=this.report(actor,from,now+1),today=this.report(actor,startToday,now+1),week=this.report(actor,startToday-6*86400000,now+1),amount=Number(this.db.prepare('SELECT amount FROM usd_budget WHERE id=1').get()!.amount);return {tariffs:this.tariffs(),budget:{amount,currency:'USD' as const},monthly:{...monthly,remaining:round(amount-monthly.spent)},periodDetails:{today,week,month:monthly},periods:{today:today.spent,week:week.spent,month:monthly.spent}};}
}

