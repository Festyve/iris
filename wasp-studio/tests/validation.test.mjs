import test from 'node:test';
import assert from 'node:assert/strict';
import { projectId, validateSnapshot, expectedRevision, isLocalRequest } from '../src/validation.mjs';
test('archive IDs cannot select filesystem-like paths', () => { assert.equal(projectId('local-studio_1'), 'local-studio_1'); for (const id of ['../project', '/etc/passwd', '', 'x'.repeat(81)]) assert.throws(() => projectId(id)); });
test('bounded project snapshots retain actual reference and version metadata', () => {
  const data = { title: 'Review app', references: ['zirui'], versions: [{ version: 2, path: 'versions/2/index.html' }] };
  assert.deepEqual(JSON.parse(validateSnapshot(data).snapshot), data);
  assert.throws(() => validateSnapshot({ text: 'x'.repeat(65_000) }), /under 64 KB/);
  assert.throws(() => validateSnapshot(JSON.parse('{"__proto__":{"polluted":true}}')), /Unsafe/);
});
test('revision guards reject invalid concurrency input', () => { assert.equal(expectedRevision(0), 0); assert.equal(expectedRevision(undefined), undefined); assert.throws(() => expectedRevision(-1)); assert.throws(() => expectedRevision('2')); });
test('local archive rejects remote sockets and hostile hosts/origins', () => {
  assert.equal(isLocalRequest('127.0.0.1', '127.0.0.1:3002', undefined), true);
  assert.equal(isLocalRequest('::1', 'localhost:3002', 'http://127.0.0.1:5173'), true);
  assert.equal(isLocalRequest('192.168.1.5', 'localhost:3002', undefined), false);
  assert.equal(isLocalRequest('127.0.0.1', 'evil.test:3002', undefined), false);
  assert.equal(isLocalRequest('127.0.0.1', 'localhost:3002', 'https://evil.test'), false);
});
