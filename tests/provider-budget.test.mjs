import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openBudget} from '../studio/provider-budget.mjs';

test('shared allowance survives reopen, caps mixed routes and resets on the next UTC day',()=>{
  const dir=mkdtempSync(join(tmpdir(),'studio-budget-'));
  const file=join(dir,'usage.sqlite');
  let day=new Date('2026-11-22T23:59:59Z');
  const a=openBudget(file,()=>day), b=openBudget(file,()=>day);
  try {
    for (let i=0;i<4;i++) assert.ok((i%2 ? a : b).admit('/screen'));
    assert.equal(a.admit('/persona-review'),false);
    assert.ok(a.admit('/repo/question'));
    assert.equal(b.status().buckets.find(v=>v.bucket==='model-output').reserved,16384);
    day=new Date('2026-11-23T00:00:00Z');assert.ok(b.admit('/persona-review'));
    const c=openBudget(file,()=>day);
    try {assert.equal(c.status().buckets.find(v=>v.bucket==='model-output').reserved,1152);} finally {c.close();}
  } finally {a.close();b.close();rmSync(dir,{recursive:true,force:true});}
});
