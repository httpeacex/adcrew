import assert from 'node:assert/strict';
import { test } from 'node:test';
import { operationsSummary } from '../src/lib/operations-report.ts';
test('summary separates task creation, acceptance and revision events within period',()=>{
 const tasks=[{id:1,status:'done',createdAt:1,completedAt:20,claimedAt:5,deadline:10,buyerId:1,creativeId:3},{id:2,status:'progress',createdAt:16,completedAt:null,claimedAt:17,deadline:40,buyerId:2,creativeId:4}] as never;
 const r=operationsSummary(tasks,[{taskId:1,action:'revise',at:12}],10,30,25);
 assert.equal(r.created,1);assert.equal(r.completed,1);assert.equal(r.averageElapsed,15);assert.equal(r.revisions,1);assert.equal(r.revisionPercent,100);assert.equal(r.overdue.length,1);
});
