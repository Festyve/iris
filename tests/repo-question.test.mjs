import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {answerQuestion, authorized} from '../wasp-studio/src/repo-question.mjs';
import {snapshot} from '../wasp-studio/src/repo-evidence.mjs';
test('citation excerpts match the immutable source', () => {
  for (const row of snapshot.rows) {
    const source=execFileSync('git',['show',snapshot.commit+':'+row.path],{encoding:'utf8'});
    assert.equal(source.split('\n')[row.line-1].trim(),row.excerpt);
  }
  assert.equal(answerQuestion({question:'Which command starts the studio locally?'}).answer,'npm start');
});
test('ambiguous and outside questions do not get guessed citations', () => {
  assert.equal(answerQuestion({question:'How does it work?'}).status,'clarification');
  assert.equal(answerQuestion({question:'Which command starts facebook/react?'}).status,'out_of_scope');
  assert.throws(()=>answerQuestion({question:' '}));
});
test('requires the configured read credential', () => {
  const token='x'.repeat(32);
  assert.equal(authorized('Bearer '+token,token),true);
  assert.equal(authorized('Bearer token',token),false);
  assert.equal(authorized(undefined,undefined),false);
});

test('current budget question cites the documented allowance', () => {
  const answer=answerQuestion({question:'What is the current daily model output token limit in this repo?'});
  assert.equal(answer.status,'answered');
  assert.equal(answer.citations[0].path,'docs/INTEGRATIONS.md');
  assert.match(answer.answer,/16,384/);
});

test('coalesces main refreshes and keeps the last complete revision on failure',async()=>{
  const {createReader}=await import('../wasp-studio/src/repo-refresh.mjs');
  let now=0, calls=0, offline=false;
  const commit='a'.repeat(40);
  const reader=createReader(async url=>{
    calls++;
    if(offline) throw Error('offline');
    if(url.startsWith('https://api.github.com/')) return Response.json({sha:commit});
    const path=url.split(commit+'/')[1];
    return new Response(execFileSync('git',['show',snapshot.commit+':'+path]));
  },()=>now);
  const [a,b]=await Promise.all([reader(),reader()]);
  assert.equal(a.commit,commit);assert.deepEqual(a,b);
  assert.equal(a.freshness,'verified-main');assert.equal(calls,4);
  offline=true;now=310000;
  const cached=await reader();
  assert.equal(cached.freshness,'last-known');assert.equal(cached.commit,commit);
  assert.deepEqual(cached.rows,a.rows);
  await reader();assert.equal(calls,5);
});
