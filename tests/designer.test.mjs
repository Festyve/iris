// The Claude designer flow, with a stand-in for the model so it runs without an API key.
import test from 'node:test';
import assert from 'node:assert/strict';
import {design, edit, designSystem, editSystem, Doc} from '../designer.mjs';

const board = {
  name: 'Fern', summary: 'A plant-care app.',
  screens: [{id: 'home', name: 'Fern · Home', w: 390, h: 844, fill: '#F4F7F2', pad: [56, 24, 24, 24], gap: 16}],
  nodes: [
    {id: 'title', parent: 'home', type: 'text', name: 'Title', text: 'Your plants', size: 30, weight: 700, color: '#14261C'},
    {id: 'card', parent: 'home', type: 'frame', name: 'Plant card', fill: '#FFFFFF', r: 20, pad: 16, gap: 8, shadow: true},
    {id: 'card-name', parent: 'card', type: 'text', name: 'Plant name', text: 'Monstera', size: 17, weight: 600, color: '#14261C'},
    {id: 'orphan', parent: 'nowhere', type: 'text', name: 'Lost', text: 'x', size: 12, color: '#000000'},
    {id: 'weird', parent: 'home', type: 'sparkle', name: 'Unknown type'}
  ]
};

test('prompts describe the format and ask for bare JSON', () => {
  for (const p of [designSystem, editSystem]) { assert.match(p, /flat list of nodes/); assert.match(p, /only one JSON object/); }
  assert.match(editSystem, /smallest set of operations/);
});

test('design sends the brief and returns a cleaned document', async () => {
  let seen;
  const out = await design('A plant care app', async (system, user) => { seen = {system, user}; return board; });
  assert.equal(seen.system, designSystem); assert.match(seen.user, /plant care/);
  assert.equal(out.doc.name, 'Fern');
  assert.ok(!out.doc.nodes.some(n => n.id === 'orphan' || n.id === 'weird'), 'bad nodes are dropped, not fatal');
  assert.equal(out.summary, 'A plant-care app.');
  await assert.rejects(design('', async () => board), /brief/);
});

test('edit sends the current design and returns ops that apply cleanly', async () => {
  const doc = Doc.clean(board);
  let user;
  const out = await edit(doc, 'Add a watering reminder', async (system, u) => {
    user = u; assert.equal(system, editSystem);
    return {summary: 'Added a watering reminder.', ops: [
      {op: 'add', parent: 'card', node: {id: 'remind', type: 'text', name: 'Reminder', text: 'Water in 2 days', size: 13, color: '#4C6B57'}},
      {op: 'set', id: 'title', node: {text: 'My plants'}},
      {op: 'remove', id: 'missing'}
    ]};
  });
  assert.match(user, /"id":"card"/); assert.match(user, /Add a watering reminder/);
  assert.equal(out.ops.length, 3); assert.equal(out.skipped, 1);
  const next = Doc.apply(doc, out.ops).doc;
  assert.equal(next.nodes.find(n => n.id === 'title').text, 'My plants');
  assert.ok(next.nodes.some(n => n.id === 'remind' && n.parent === 'card'));
});
