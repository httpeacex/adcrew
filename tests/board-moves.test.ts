import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardDropAction } from '../src/lib/board-moves.ts';
test('dragging respects owner and real workflow transitions',()=>{
 const task={status:'progress' as const,buyerId:1,creativeId:3};
 assert.equal(boardDropAction({id:4,role:'creative'},task,'review'),null);
 assert.equal(boardDropAction({id:3,role:'creative'},task,'review'),'submit');
 assert.equal(boardDropAction({id:3,role:'creative'},task,'done'),null);
 assert.equal(boardDropAction({id:1,role:'buyer'},{...task,status:'review'},'revision'),'revise');
 assert.equal(boardDropAction({id:1,role:'buyer'},{...task,status:'review'},'done'),'accept');
 assert.equal(boardDropAction({id:3,role:'creative'},{...task,status:'new',creativeId:null},'progress'),'claim');
});
