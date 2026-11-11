import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProductStore } from '../src/lib/product-store.ts';
import type { Profile, Brief } from '../src/lib/workflow.ts';
const people = ['buyer','buyer','creative','creative','lead'].map((role,i) => ({id:i+1,role,name:`Person ${i}`,email:`p${i}@test.dev`,initials:'P',color:'violet'} as Profile));
const [buyer,other,creative,,lead] = people;
const now = Date.parse('2026-11-11T00:00:00Z');
const brief: Brief = {offer:'Test',geo:'DE',format:'image',quantity:1,description:'Brief',references:[],priority:'normal',deadline:now+86400000};
function setup() { const s=new ProductStore(':memory:'); for(const p of people)s.addProfile(p,'password'); const id=s.create(buyer,brief,'new',now); return {s,id}; }
test('comments enforce task scope, valid rounds and isolate notice reads',()=>{
 const {s,id}=setup(); try {
 assert.throws(()=>s.productCommand(other,'/api/product/comment',{taskId:String(id),body:'hello'},now),{status:404});
 assert.throws(()=>s.productCommand(buyer,'/api/product/comment',{taskId:String(id),body:'hello',round:'1'},now));
 s.act(creative,id,'claim',0,'claim',{},now);
 s.productCommand(buyer,'/api/product/comment',{taskId:String(id),body:'hello',mentionIds:String(creative.id)},now);
 assert.equal(s.taskExtras(creative,id).comments[0].body,'hello');
 assert.equal(Object.getPrototypeOf(s.profile(buyer.id)),Object.prototype);
 assert.equal(Object.getPrototypeOf(s.productSnapshot(buyer,now).members[0]),Object.prototype);
 assert.equal(Object.getPrototypeOf(s.taskExtras(creative,id).members[0]),Object.prototype);
 assert.equal(Object.getPrototypeOf(s.taskExtras(creative,id).comments[0]),Object.prototype);
 assert.equal(s.productSnapshot(other,now).notices.length,0);
 const notice=s.productSnapshot(creative,now).notices[0];
 s.productCommand(other,'/api/product/read',{noticeId:String(notice.id)},now);
 assert.equal(s.productSnapshot(creative,now).notices[0].read,false);
 s.productCommand(creative,'/api/product/read',{},now);
 assert.ok(s.productSnapshot(creative,now).notices.every(n=>n.read));
 } finally{s.db.close();}
});
test('assignment is versioned, audited and preserves checklist',()=>{
 const {s,id}=setup(); try {
 s.productCommand(buyer,'/api/product/check',{taskId:String(id),key:'brief',checked:'true'},now);
 assert.throws(()=>s.productCommand(buyer,'/api/product/assign',{taskId:String(id),creativeId:'3',version:'0'},now),{status:403});
 s.productCommand(lead,'/api/product/assign',{taskId:String(id),creativeId:'3',version:'0'},now);
 assert.equal(s.task(lead,id)?.task.version,1);
 assert.equal(s.task(lead,id)?.task.status,'progress');
 assert.ok(s.taskExtras(buyer,id).checks.brief);
 assert.equal(s.task(lead,id)?.events.length,2);
 assert.throws(()=>s.productCommand(lead,'/api/product/assign',{taskId:String(id),creativeId:'4',version:'0'},now),{status:409});
 s.act(creative,id,'submit',1,'submit-assigned',{files:[{name:'a.png',type:'image/png',data:Uint8Array.of(1)}]},now+3600000);
 s.act(buyer,id,'accept',2,'accept-assigned',{},now+7200000);
 assert.equal(s.analytics(lead,'2026-11-11','2026-11-11',now+7200000).average.production,3600000);
 } finally{s.db.close();}
});
test('templates, credentials, monetary rates and idempotent notifications',()=>{
 const {s,id}=setup(); try {
 s.productCommand(buyer,'/api/product/template',{taskId:String(id),name:'Saved'},now);
 assert.equal(s.productSnapshot(buyer,now).templates[0].brief.offer,'Test');
 assert.equal(s.productSnapshot(other,now).templates.length,0);
 s.productCommand(lead,'/api/product/member',{name:'New person',email:'new@test.dev',role:'creative',password:'strong-password'},now);
 assert.ok(s.authenticate('new@test.dev','strong-password'));
 s.productCommand(lead,'/api/product/rate',{service:'Runway',price:'0.5',currency:'RUB'},now);
 s.productCommand(lead,'/api/product/budget',{amount:'100'},now);
 s.act(creative,id,'claim',0,'claim',{},now);
 const cmd={files:[{name:'a.png',type:'image/png',data:Uint8Array.of(1)}],usage:[{service:'Runway',units:2000}]};
 s.act(creative,id,'submit',1,'submit',cmd,now);
 const count=s.productSnapshot(buyer,now).notices.length;
 s.act(creative,id,'submit',1,'submit',cmd,now);
 assert.equal(s.productSnapshot(buyer,now).notices.length,count);
 assert.equal(s.productSnapshot(lead,now).metrics.spent,1);
 assert.equal(s.productSnapshot(lead,now).metrics.remaining,99);
 assert.equal(Object.getPrototypeOf(s.analytics(lead,'2026-11-11','2026-11-11',now).usage[0]),Object.prototype);
 s.productCommand(lead,'/api/product/rate',{service:'Runway',price:'0.0001',currency:'RUB'},now);
 assert.equal(s.productSnapshot(lead,now).rates.find(r=>r.service==='Runway')?.price,0.0001);
 } finally{s.db.close();}
});
test('product requests replay without duplicate comments, templates or members and deadline notices stay read',()=>{
 const {s,id}=setup();try{
 const comment={taskId:String(id),body:'Once',requestId:'comment-once'};
 s.productCommand(buyer,'/api/product/comment',comment,now);
 s.productCommand(buyer,'/api/product/comment',comment,now);
 assert.equal(s.taskExtras(buyer,id).comments.length,1);
 assert.throws(()=>s.productCommand(buyer,'/api/product/comment',{...comment,body:'Changed'},now),{status:409});
 const template={taskId:String(id),name:'Once',requestId:'template-once'};
 s.productCommand(buyer,'/api/product/template',template,now);
 s.productCommand(buyer,'/api/product/template',template,now);
 assert.equal(s.productSnapshot(buyer,now).templates.length,1);
 const member={name:'New user',email:'once@test.dev',role:'buyer',password:'password123',requestId:'member-once'};
 s.productCommand(lead,'/api/product/member',member,now);
 s.productCommand(lead,'/api/product/member',member,now);
 assert.ok(s.authenticate(member.email,member.password));
 assert.equal(s.productCommand(lead,'/api/product/budget',{amount:'10'},now).path,'/ai-expenses');
 const later=now+86400001;
 const notice=s.productSnapshot(buyer,later).notices.find(n=>n.title.includes('Просрочен'))!;
 assert.ok(notice);
 s.productCommand(buyer,'/api/product/read',{noticeId:String(notice.id)},later);
 assert.ok(s.productSnapshot(buyer,later).notices.find(n=>n.id===notice.id)?.read);
 assert.equal(s.productSnapshot(other,later).notices.length,0);
 }finally{s.db.close();}
});

