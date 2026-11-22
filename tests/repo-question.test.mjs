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
