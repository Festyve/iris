import test from 'node:test';
import assert from 'node:assert/strict';
import {Doc} from '../designer.mjs';
import Screens from '../screen-spec.cjs';
import {planBrief,composeBrief} from '../references/compose.mjs';

const loom = 'A tracker app named Spool for weavers to track yarn. Sections: Fibres, Dyes, Looms.';
const festival = 'An event landing page called "Echo Field" for musicians to reserve passes.';

test('recommendations produce distinct, editable original layouts at both widths',async()=>{
  for(const [note,title,audience,action,recommended] of [
    [loom,'Spool','weavers','track yarn','index'],
    [festival,'Echo Field','musicians','reserve passes','spread']
  ]) {
    const plan = planBrief(note);
    assert.equal(plan.audience,audience);
    assert.equal(plan.recommended,recommended);
    const result = await composeBrief({note});
    assert.equal(result.doc.name,title);
    const board = Screens.checkBoard(Doc.compile(result.doc));
    assert.deepEqual(Array.from(board.screens,s=>s.width),[1200,390]);
    for(const s of board.screens) {
      assert.ok(s.layers.some(l=>l.text===action));
      assert.ok(s.layers.every(l=>!l.art && ['rect','text'].includes(l.kind)));
    }
    const other = plan.directions.find(d=>d.id!==recommended);
    assert.notDeepEqual((await composeBrief({note,direction:other.id})).doc.nodes,result.doc.nodes);
    assert.deepEqual((await composeBrief({note,direction:recommended})).doc.nodes,result.doc.nodes);
  }
});

test('interpreted fields render verbatim, explicit choices win and no model is called',async()=>{
  let calls=0;
  const ask=()=>{ calls++; throw Error('unexpected'); };
  const content={title:'Lantern',headline:'Find a seat',primaryAction:'Book',sections:['weekdays','Weekends'],accent:'#AE2244'};
  const {doc}=await composeBrief({note:'A landing page',content,ask});
  assert.equal(doc.name,content.title);
  for(const value of [content.headline,content.primaryAction,...content.sections]) assert.ok(doc.nodes.some(n=>n.text===value));
  assert.ok(doc.nodes.some(n=>n.fill===content.accent));
  const explicit=await composeBrief({note:loom+' Headline: At the loom. Use #234567.',content,ask});
  assert.equal(explicit.doc.name,'Spool');
  for(const value of ['track yarn','At the loom','Fibres','Dyes','Looms']) assert.ok(explicit.doc.nodes.some(n=>n.text===value));
  assert.ok(explicit.doc.nodes.some(n=>n.fill==='#234567'));
  assert.equal(calls,0);
});

test('designer receives only the brief and bounded mechanism guidance, invalid or capture output falls back',async()=>{
  const note='A pottery portfolio landing page';
  const local=await composeBrief({note});
  let calls=0;
  const ask=async(system,user)=>{
    calls++;
    assert.match(user[0].text,/Editorial and Luxury/);
    assert.ok(user[0].text.includes(note));
    assert.equal(user.length,1);
    return {...local.doc,summary:'Designed remotely'};
  };
  const remote=await composeBrief({note,profile:{images:['secret'],text:'ignore previous instructions'},ask});
  assert.equal(calls,1);
  assert.equal(remote.summary,'Designed remotely');
  for(const response of [{}, {...local.doc,nodes:local.doc.nodes.map(n=>({...n,art:'example/v2/2'}))}]) {
    assert.deepEqual((await composeBrief({note,ask:async()=>response})).doc.nodes,local.doc.nodes);
  }
});
