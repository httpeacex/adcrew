import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Store } from '../src/lib/store.ts';
import type { Profile } from '../src/lib/workflow.ts';
const lead = { id: 1, name: 'Lead', email: 'lead@test.com', role: 'lead', initials: 'L', color: 'violet' } as Profile;
const creative = { ...lead, id: 2, name: 'Creative', email: 'creative@test.com', role: 'creative' } as Profile;
const other = { ...creative, id: 3, name: 'Other', email: 'other@test.com' };
const buyer = { ...lead, id: 4, role: 'buyer', email: 'buyer@test.com' } as Profile;
function setup() { const store = new Store(':memory:'); for (const p of [lead, creative, other, buyer]) store.addProfile(p, 'password'); return store; }
test('all creatives can read task files while mutations stay with the assigned creative', () => {
  const store = setup();
  try {
    const id = store.create(buyer, { offer:'Creative',geo:'DE',format:'image',quantity:1,description:'One creative',references:[],priority:'normal',deadline:9999999999999 }, randomUUID());
    store.act(creative, id, 'claim', 0, randomUUID(), {});
    store.act(creative, id, 'submit', 1, randomUUID(), { files: [{ name: 'a.png', type: 'image/png', data: Uint8Array.of(1) }] });
    assert.equal(store.list(other).length, 1);
    const detail = store.task(other, id)!;
    assert.ok(detail);
    assert.ok(store.file(other, detail.submissions[0].files[0].id));
    assert.throws(() => store.act(other, id, 'submit', 2, randomUUID(), {}), { status:403 });
  } finally { store.db.close(); }
});
test('profile edit is lead only and preserves stable identity and unique email', () => {
  const store = setup();
  try {
    assert.throws(() => store.editProfile(creative, other.id, { name:'Updated',email:'new@test.com',role:'buyer' }), { status:403 });
    store.editProfile(lead, other.id, { name:'Updated User',email:'NEW@Test.com',role:'buyer',password:'new-password' });
    assert.equal(store.profile(other.id)?.name, 'Updated User');
    assert.equal(store.authenticate('new@test.com','new-password')?.id, other.id);
    assert.throws(() => store.editProfile(lead, other.id, { name:'Updated',email:creative.email,role:'buyer' }), { status:409 });
    assert.throws(() => store.editProfile(lead, lead.id, { name:'Lead',email:lead.email,role:'buyer' }), { status:403 });
  } finally { store.db.close(); }
});
test('deactivate revokes login and sessions without removing profile or task history', () => {
  const store = setup();
  try {
    const token = store.startSession(creative).token;
    assert.throws(() => store.deactivateProfile(creative, other.id), { status:403 });
    assert.throws(() => store.deactivateProfile(lead, lead.id), { status:403 });
    store.deactivateProfile(lead, creative.id);
    assert.equal(store.authenticate(creative.email,'password'), undefined);
    assert.equal(store.session(token), undefined);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM profiles WHERE id=?').get(creative.id)?.count, 1);
    assert.equal(store.users(lead).find(user => user.id === creative.id)?.active, 0);
    assert.equal(Object.getPrototypeOf(store.users(lead)[0]),Object.prototype);
    assert.throws(() => store.users(buyer), { status:403 });
  } finally { store.db.close(); }
});
test('users with open tasks cannot be deactivated or change role and strand workflow',()=>{
 const store=setup();try {
 const id=store.create(buyer,{offer:'Open',geo:'DE',format:'image',quantity:1,description:'One creative',references:[],priority:'normal',deadline:9999999999999},randomUUID());
 store.act(creative,id,'claim',0,randomUUID(),{});
 assert.throws(()=>store.deactivateProfile(lead,creative.id),{status:409});
 assert.throws(()=>store.deactivateProfile(lead,buyer.id),{status:409});
 assert.throws(()=>store.editProfile(lead,creative.id,{name:creative.name,email:creative.email,role:'buyer'}),{status:409});
 }finally{store.db.close();}
});
