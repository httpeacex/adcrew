import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dashboardData } from '../src/lib/dashboard.ts';
import type { Task } from '../src/lib/workflow.ts';
const now = Date.parse('2026-11-13T12:00:00+05:00');
const task = (id: number, patch: Partial<Task> = {}): Task => ({id,offer:`Task ${id}`,geo:'DE',format:'image',quantity:1,description:'Brief',references:[],priority:'normal',deadline:now+3600000,status:'new',buyerId:1,creativeId:null,version:0,createdAt:now-3600000,claimedAt:null,submittedAt:null,completedAt:null,buyerName:'Buyer',creativeName:null,creativeInitials:null,creativeColor:null,...patch});
test('buyer metrics and review queue exclude other buyers even with unscoped input',()=>{
 const d=dashboardData([task(1,{status:'review',creativeId:3}),task(2,{buyerId:2,status:'review'}),task(3,{status:'done',completedAt:now})],{id:1,role:'buyer'},now);
 assert.equal(d.tasks.length,2);assert.equal(d.counts.active,1);assert.equal(d.counts.review,1);assert.equal(d.counts.done,1);assert.deepEqual(d.review.map(t=>t.id),[1]);
});
test('creative free queue excludes assigned new tasks; revisions and production stay separate',()=>{
 const d=dashboardData([task(1),task(2,{creativeId:4}),task(3,{status:'revision',creativeId:3}),task(4,{status:'progress',creativeId:3}),task(5,{status:'progress',creativeId:4})],{id:3,role:'creative'},now);
 assert.deepEqual(d.free.map(t=>t.id),[1]);assert.equal(d.counts.progress,1);assert.equal(d.counts.revision,1);assert.deepEqual(d.mine.map(t=>t.id),[3,4]);
});
test('attention distinguishes impending and expired deadlines and excludes done',()=>{
 const d=dashboardData([task(1),task(2,{deadline:now-1}),task(3,{deadline:now+7200001}),task(4,{status:'done',deadline:now-1,completedAt:now})],{id:9,role:'lead'},now);
 assert.deepEqual(d.attention.map(x=>[x.task.id,x.reason]),[[2,'Просрочено'],[1,'Риск срыва срока']]);
});
test('completed today uses acceptance date in UTC+5 and tasks sort by priority then deadline',()=>{
 const d=dashboardData([task(1,{creativeId:3,status:'done',completedAt:Date.parse('2026-11-12T20:00:00Z')}),task(2,{creativeId:3,status:'done',completedAt:Date.parse('2026-11-12T18:00:00Z')}),task(3,{creativeId:3,priority:'urgent'}),task(4,{creativeId:3,priority:'high'})],{id:3,role:'creative'},now);
 assert.equal(d.completedToday.length,1);assert.deepEqual(d.mine.map(t=>t.id),[3,4]);
});
