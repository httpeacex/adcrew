import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Store } from '../src/lib/store.ts';
import { actionsFor, canRead, validateBrief, type Brief, type Profile } from '../src/lib/workflow.ts';
const buyer = { id:1,role:'buyer',email:'b@test',name:'Buyer',initials:'B',color:'blue' } as Profile;
const creative = {...buyer,id:2,role:'creative',email:'c@test'} as Profile;
const other = {...creative,id:3,email:'o@test'};
const lead = {...buyer,id:4,role:'lead',email:'l@test'} as Profile;
const brief:Brief={offer:'Creative',geo:'DE',format:'image',quantity:1,description:'One creative',references:[],priority:'normal',deadline:9999999999999};
function setup(){const store=new Store(':memory:'); for(const p of [buyer,creative,other,lead])store.addProfile(p,'pass'); return store;}
test('create and brief validation reject multiple independent creatives',()=>{const s=setup();try {assert.throws(()=>s.create(buyer,{...brief,quantity:2},randomUUID()),{status:400});assert.throws(()=>validateBrief({...brief,quantity:'2',deadline:'2099-11-13T18:00'}),{field:'quantity'});}finally{s.db.close();}});
test('release frees an unsubmitted task and another creative can claim it',()=>{const s=setup();try{const id=s.create(buyer,brief,randomUUID());s.act(creative,id,'claim',0,randomUUID(),{});assert.throws(()=>s.act(other,id,'release',1,randomUUID(),{}));s.act(creative,id,'release',1,randomUUID(),{});const t=s.task(buyer,id)!.task;assert.equal(t.status,'new');assert.equal(t.creativeId,null);s.act(other,id,'claim',2,randomUUID(),{});assert.equal(s.task(buyer,id)!.task.creativeId,other.id);}finally{s.db.close();}});
test('soft delete preserves history but removes task from active access',()=>{const s=setup();try{const id=s.create(buyer,brief,randomUUID());const key=randomUUID();s.act(buyer,id,'delete',0,key,{});assert.equal(s.act(buyer,id,'delete',0,key,{}),id);assert.equal(s.task(lead,id),null);assert.equal(s.list(lead).length,0);assert.equal(s.taskCounts(lead).total,0);assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM tasks').get()!.n,1);assert.equal(s.workspaceHistory(lead).length,2);}finally{s.db.close();}});
test('submitted and revision tasks cannot be released deleted or reassigned',()=>{const s=setup();try{const id=s.create(buyer,brief,randomUUID());s.act(creative,id,'claim',0,randomUUID(),{});s.act(creative,id,'submit',1,randomUUID(),{files:[{name:'a.png',type:'image/png',data:Uint8Array.of(1)}]});for(const actor of [buyer,lead])assert.throws(()=>s.act(actor,id,'delete',2,randomUUID(),{}));assert.throws(()=>s.assign(lead,id,other.id,2,randomUUID()),{status:403});s.act(buyer,id,'revise',2,randomUUID(),{note:'Fix color'});assert.throws(()=>s.act(creative,id,'release',3,randomUUID(),{}),{status:403});assert.equal(s.task(buyer,id)!.submissions[0].files.length,1);}finally{s.db.close();}});
test('lead assignment validates role and version and records history',()=>{const s=setup();try{const id=s.create(buyer,brief,randomUUID());assert.throws(()=>s.assign(buyer,id,creative.id,0,randomUUID()),{status:403});s.assign(lead,id,creative.id,0,randomUUID());assert.equal(s.task(buyer,id)!.task.creativeId,creative.id);assert.equal(s.task(buyer,id)!.task.status,'progress');assert.throws(()=>s.assign(lead,id,other.id,0,randomUUID()),{status:409});s.assign(lead,id,other.id,1,randomUUID());assert.equal(s.task(buyer,id)!.events.at(-1)!.action,'assign');}finally{s.db.close();}});

test('assigned legacy new tasks are not claimable by another creative', () => {
  const task = { status: 'new' as const, buyerId: buyer.id, creativeId: creative.id };
  assert.equal(canRead(other, task), true);
  assert.deepEqual(actionsFor(other, task), []);
});

test('existing database upgrade preserves legacy quantities results expenses and history', () => {
  const directory = mkdtempSync(join(tmpdir(), 'adcrew-lifecycle-'));
  const file = join(directory, 'legacy.sqlite');
  let store = new Store(file);
  try {
    for (const person of [buyer, creative, other, lead]) store.addProfile(person, 'pass');
    const id = store.create(buyer, brief, randomUUID());
    store.act(creative, id, 'claim', 0, randomUUID(), {});
    store.act(creative, id, 'submit', 1, randomUUID(), {
      files: [{ name: 'legacy.png', type: 'image/png', data: Uint8Array.of(1, 2) }],
      usage: [{ service: 'Runway', units: 2500 }],
    });
    store.db.exec(`UPDATE tasks SET quantity=4;
      ALTER TABLE tasks DROP COLUMN deletedAt;
      ALTER TABLE task_events RENAME TO old_events;
      CREATE TABLE task_events (id INTEGER PRIMARY KEY,taskId INTEGER NOT NULL REFERENCES tasks(id),actorId INTEGER NOT NULL REFERENCES profiles(id),action TEXT NOT NULL CHECK(action IN ('create','claim','submit','revise','accept')),fromStatus TEXT,toStatus TEXT NOT NULL,at INTEGER NOT NULL,round INTEGER,requestId TEXT NOT NULL,fingerprint TEXT NOT NULL,UNIQUE(actorId,requestId)) STRICT;
      INSERT INTO task_events SELECT * FROM old_events;
      DROP TABLE old_events;
      CREATE INDEX task_events_task ON task_events(taskId,id);
      ALTER TABLE ai_usage RENAME TO old_usage;
      CREATE TABLE ai_usage (submissionId INTEGER NOT NULL REFERENCES submissions(id),service TEXT NOT NULL,units INTEGER NOT NULL CHECK(units > 0),PRIMARY KEY(submissionId,service)) STRICT;
      INSERT INTO ai_usage SELECT * FROM old_usage;
      DROP TABLE old_usage;`);
    store.db.close();
    store = new Store(file);
    const detail = store.task(buyer, id)!;
    assert.equal(detail.task.quantity, 4);
    assert.equal(detail.events.length, 3);
    assert.equal(detail.submissions[0].usage[0].units, 2500);
    assert.deepEqual(store.file(buyer, detail.submissions[0].files[0].id)?.data, Uint8Array.of(1, 2));
    assert.throws(() => store.act(buyer, id, 'delete', 2, randomUUID(), {}), { status: 403 });
  } finally {
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
