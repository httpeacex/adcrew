import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProductStore } from '../src/lib/product-store.ts';
import type { Profile, Brief } from '../src/lib/workflow.ts';
const people=['buyer','creative','lead'].map((role,i)=>({id:i+1,role,name:role,email:`${role}@test.dev`,initials:'P',color:'violet'} as Profile));
const [buyer,creative,lead]=people,now=Date.parse('2026-11-13T07:00:00Z');
const brief:Brief={offer:'Test',geo:'DE',format:'image',quantity:1,description:'Brief',references:[],priority:'normal',deadline:now+86400000};
function setup(){const s=new ProductStore(':memory:');people.forEach(p=>s.addProfile(p,'password'));return s;}
const files=[{name:'a.png',type:'image/png',data:Uint8Array.of(1)}];
test('USD tariffs snapshot submission and revision cost, budget and legacy remain distinct',()=>{const s=setup();try{
 s.productCommand(lead,'/api/product/rate',{service:'Runway',price:'50',currency:'RUB'},now);
 s.productCommand(lead,'/api/product/usd-tariff',{service:'Runway',kind:'credits',price:'20',credits:'100'},now);
 s.productCommand(lead,'/api/product/usd-budget',{amount:'100'},now);
 const id=s.create(buyer,brief,'create',now);s.act(creative,id,'claim',0,'claim',{},now);
 const cmd={files,usage:[{service:'Runway',units:10000}]};s.act(creative,id,'submit',1,'submit',cmd,now);s.act(creative,id,'submit',1,'submit',cmd,now);
 s.productCommand(lead,'/api/product/usd-tariff',{service:'Runway',kind:'credits',price:'40',credits:'100'},now+100);
 s.act(buyer,id,'revise',2,'revise',{note:'Fix it'},now+200);s.act(creative,id,'submit',3,'submit2',{files,usage:[{service:'Runway',units:5000}]},now+300);
 s.act(buyer,id,'accept',4,'accept',{},now+400);
 const f=s.financeReport(lead,now-1000,now+1000);assert.equal(f.spent,4);assert.equal(f.revisionSpent,2);assert.equal(f.expenses.length,2);assert.equal(f.services[0].spent,4);assert.equal(f.employees[0].spent,4);assert.equal(f.averageCost,4);
 const snap=s.productSnapshot(lead,now+400);assert.equal(snap.finance.monthly.remaining,96);assert.equal(snap.finance.periods.today,4);assert.equal(snap.rates[0].currency,'RUB');assert.equal(snap.rates[0].price,50);
 assert.throws(()=>s.productCommand(buyer,'/api/product/usd-budget',{amount:'1'},now),{status:403});
 }finally{s.db.close();}});
test('subscription without credits records usage without allocation and forbids zero-credit tariff',()=>{const s=setup();try{
 assert.throws(()=>s.productCommand(lead,'/api/product/usd-tariff',{service:'ChatGPT',kind:'credits',price:'20',credits:'0'},now));
 s.productCommand(lead,'/api/product/usd-tariff',{service:'ChatGPT',kind:'subscription',price:'20'},now);
 const id=s.create(buyer,brief,'create',now);s.act(creative,id,'claim',0,'claim',{},now);s.act(creative,id,'submit',1,'submit',{files,usage:[{service:'ChatGPT',units:0}]},now);
 const f=s.financeReport(lead,now-1,now+1);assert.equal(f.spent,0);assert.equal(f.unallocated,1);assert.equal(f.expenses[0].cost,null);assert.equal(s.productSnapshot(lead,now).finance.tariffs[0].unitPrice,null);
 }finally{s.db.close();}});
test('missing prices are frozen as unknown and never retrospectively priced',()=>{const s=setup();try{const id=s.create(buyer,brief,'create',now);s.act(creative,id,'claim',0,'claim',{},now);s.act(creative,id,'submit',1,'submit',{files,usage:[{service:'Kling',units:1000}]},now);s.productCommand(lead,'/api/product/usd-tariff',{service:'Kling',kind:'credits',price:'100',credits:'100'},now+1);assert.equal(s.financeReport(lead,now-1,now+2).unknown,1);assert.equal(s.financeReport(lead,now-1,now+2).spent,0);}finally{s.db.close();}});
test('manual subscription payments are idempotent, unallocated and scoped away from employee reports',()=>{const s=setup();try{
 s.productCommand(lead,'/api/product/usd-tariff',{service:'ChatGPT',kind:'subscription',price:'20'},now);
 const payment={service:'ChatGPT',amount:'20',note:'November subscription',requestId:'payment-1'};
 assert.throws(()=>s.productCommand(creative,'/api/product/usd-charge',payment,now),{status:403});
 s.productCommand(lead,'/api/product/usd-charge',payment,now);s.productCommand(lead,'/api/product/usd-charge',payment,now);
 assert.throws(()=>s.productCommand(lead,'/api/product/usd-charge',{...payment,amount:'30'},now),{status:409});
 const f=s.financeReport(lead,now-1,now+1);assert.equal(f.spent,20);assert.equal(f.subscriptionSpent,20);assert.equal(f.charges.length,1);assert.equal(f.revisionSpent,0);assert.equal(f.employees.length,0);assert.equal(f.averageCost,null);
 assert.equal(s.financeReport(creative,now-1,now+1).spent,0);
 assert.equal(s.financeReport(lead,now+1,now+2).spent,0);
 }finally{s.db.close();}});
test('average credit cost divides by accepted creatives, including accepted no-AI creatives',()=>{const s=setup();try{
 s.productCommand(lead,'/api/product/usd-tariff',{service:'Kling',kind:'credits',price:'10',credits:'10'},now);
 for(let n=0;n<2;n++){const id=s.create(buyer,brief,`create${n}`,now);s.act(creative,id,'claim',0,`claim${n}`,{},now);s.act(creative,id,'submit',1,`submit${n}`,{files,usage:n===0?[{service:'Kling',units:2000}]:[]},now);s.act(buyer,id,'accept',2,`accept${n}`,{},now);}
 const pending=s.create(buyer,brief,'create-pending',now);s.act(creative,pending,'claim',0,'claim-pending',{},now);s.act(creative,pending,'submit',1,'submit-pending',{files},now);
 const f=s.financeReport(lead,now-1,now+1);assert.equal(f.averageCost,1);assert.equal(f.employees[0].creativeId,creative.id);assert.equal(f.employees[0].spent,2);
 const other:Profile={id:4,role:'buyer',name:'Other',email:'other@test.dev',initials:'O',color:'violet'};s.addProfile(other,'password');assert.equal(s.financeReport(other,now-1,now+1).spent,0);
 }finally{s.db.close();}});
test('unknown pricing and unallocated subscriptions never produce a misleading zero average',()=>{const s=setup();try{
 const id=s.create(buyer,brief,'create',now);s.act(creative,id,'claim',0,'claim',{},now);s.act(creative,id,'submit',1,'submit',{files,usage:[{service:'Kling',units:1000}]},now);
 assert.equal(s.financeReport(lead,now-1,now+1).averageCost,null);
 s.productCommand(lead,'/api/product/usd-tariff',{service:'ChatGPT',kind:'subscription',price:'20'},now);
 s.productCommand(lead,'/api/product/usd-charge',{service:'ChatGPT',amount:'20',note:'November subscription'},now);
 assert.equal(s.financeReport(lead,now-1,now+1).averageCost,null);
 }finally{s.db.close();}});
test('today week and month completeness remain independent across month boundaries',()=>{const s=setup();try{
 const submitted=Date.parse('2026-10-31T17:00:00Z'),check=Date.parse('2026-11-02T07:00:00Z');
 const id=s.create(buyer,{...brief,deadline:check},'create',submitted);s.act(creative,id,'claim',0,'claim',{},submitted);s.act(creative,id,'submit',1,'submit',{files,usage:[{service:'Kling',units:1000}]},submitted);
 const f=s.productSnapshot(lead,check).finance;assert.equal(f.periodDetails.week.unknown,1);assert.equal(f.periodDetails.month.unknown,0);assert.equal(f.periodDetails.today.unknown,0);
 }finally{s.db.close();}});
test('credit purchases add stock once and tariff updates preserve stock and frozen costs',()=>{const s=setup();try{
 s.productCommand(lead,'/api/product/usd-tariff',{service:'Runway',kind:'credits',price:'20',credits:'100'},now);
 const id=s.create(buyer,brief,'create',now);s.act(creative,id,'claim',0,'claim',{},now);
 s.act(creative,id,'submit',1,'submit',{files,usage:[{service:'Runway',units:10000}]},now);
 const purchase={service:'Runway',amount:'25',credits:'40',requestId:'purchase1'};
 s.productCommand(lead,'/api/product/usd-credit-purchase',purchase,now+1);s.productCommand(lead,'/api/product/usd-credit-purchase',purchase,now+1);
 s.productCommand(lead,'/api/product/usd-tariff',{service:'Runway',kind:'credits',price:'40',credits:'50'},now+2);
 const report=s.financeReport(lead,now-1,now+3);
 assert.equal(report.creditBalances[0].remainingCredits,130);assert.equal(report.creditPurchases.length,1);assert.equal(report.expenses[0].cost,2);assert.equal(report.creditPurchases[0].amount,25);
 }finally{s.db.close();}});
test('lead assigns an actual subscription payment to work and the same dollars are counted once',()=>{const s=setup();try{
 s.productCommand(lead,'/api/product/usd-tariff',{service:'ChatGPT',kind:'subscription',price:'10'},now);
 s.productCommand(lead,'/api/product/usd-charge',{service:'ChatGPT',amount:'10',note:'November subscription'},now);
 const id=s.create(buyer,brief,'create',now);s.act(creative,id,'claim',0,'claim',{},now);
 s.act(creative,id,'submit',1,'submit',{files,usage:[{service:'ChatGPT',units:0}]},now);s.act(buyer,id,'revise',2,'revise',{note:'Fix title'},now);
 s.act(creative,id,'submit',3,'submit2',{files,usage:[{service:'ChatGPT',units:0}]},now);s.act(buyer,id,'accept',4,'accept',{},now);
 const before=s.financeReport(lead,now-1,now+1),chargeId=String(before.charges[0].id),submissionId=String(before.expenses[0].submissionId);
 const allocate={chargeId,submissionId,amount:'6'};
 assert.throws(()=>s.productCommand(creative,'/api/product/usd-subscription-allocation',allocate,now),{status:403});
 assert.throws(()=>s.productCommand(lead,'/api/product/usd-subscription-allocation',{...allocate,amount:'11'},now));
 s.productCommand(lead,'/api/product/usd-subscription-allocation',allocate,now);
 s.productCommand(lead,'/api/product/usd-subscription-allocation',{chargeId,submissionId:String(before.expenses[1].submissionId),amount:'4'},now);
 const after=s.financeReport(lead,now-1,now+1);assert.equal(after.spent,10);assert.equal(after.employees[0].spent,10);assert.equal(after.revisionSpent,6);assert.equal(after.charges[0].remaining,0);assert.equal(after.averageCost,10);
 }finally{s.db.close();}});
test('crossing budget does not block submission and warns the lead',()=>{const s=setup();try{
 s.productCommand(lead,'/api/product/usd-budget',{amount:'1'},now);
 s.productCommand(lead,'/api/product/usd-tariff',{service:'Runway',kind:'credits',price:'20',credits:'100'},now);
 const id=s.create(buyer,brief,'create',now);s.act(creative,id,'claim',0,'claim',{},now);
 s.act(creative,id,'submit',1,'submit',{files,usage:[{service:'Runway',units:10000}]},now);
 assert.equal(s.task(buyer,id)?.task.status,'review');
 const snapshot=s.productSnapshot(lead,now);assert.equal(snapshot.finance.monthly.overBudget,true);assert.equal(snapshot.finance.monthly.excess,1);
 assert.equal(snapshot.notices.filter(n=>n.title.includes('бюджет')).length,1);
 }finally{s.db.close();}});
