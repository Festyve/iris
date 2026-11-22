import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiPlanner, AiPlanningError } from '../studio/ai-planner.mjs';
import { compileArtifact, verifyArtifact, planBuild } from '../studio/compiler.mjs';

const refs = [{ id: 'reference-search', title: 'A searchable index', tags: ['search'], adaptation: 'Put title search above the collection.' }];
const resultPlan = overrides => ({ title: 'Research Desk', kind: 'app', profile: 'library', direction: 'index', accent: '#184a99', search: true, filter: false,
  decisions: [{ id: 'reference-search', feature: 'search', rationale: 'Search entry titles above the index.' }], suggestion: 'Add filter', ...overrides });
const envelope = plan => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(plan) }] } }] });
const configured = options => createAiPlanner({ apiKey: 'test-gemini-secret', ...options });
const errorIs = (status, code) => error => error instanceof AiPlanningError && error.status === status && error.code === code;

test('a real provider-produced plan reaches the bounded compiler with exact reference IDs', async () => {
  let calls = 0;
  const planner = configured({ fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'test-gemini-secret');
    const request = JSON.parse(options.body);
    assert.equal(request.generationConfig.responseMimeType, 'application/json');
    assert.equal(request.generationConfig.maxOutputTokens, 1536);
    const input = JSON.parse(request.contents[0].parts[0].text);
    assert.equal(input.references[0].id, 'reference-search');
    assert(request.systemInstruction.parts[0].text.includes('untrusted data'));
    return envelope(resultPlan());
  } });
  const plan = await planner.plan({ brief: 'Build an app for research notes with search', references: refs });
  assert.equal(calls, 1);
  assert.equal(plan.planningMode, 'gemini');
  assert.equal(plan.planningModel, 'gemini-2.5-flash');
  assert.deepEqual(plan.referenceIds, ['reference-search']);
  assert.equal(plan.decisions[0].source, 'A searchable index');
  assert.equal(verifyArtifact(compileArtifact(plan), plan).length, 4);
});

test('a revision sends only bounded prior-plan data and enforces the requested direction', async () => {
  const previous = { ...planBuild({ brief: 'Build an app for research notes' }), html: '<script>do-not-forward</script>', apiKey: 'private-do-not-forward' };
  const planner = configured({ fetchImpl: async (_url, options) => {
    const request = JSON.parse(options.body);
    const input = JSON.parse(request.contents[0].parts[0].text);
    assert.equal(input.previous.title, previous.title);
    assert.equal(input.previous.html, undefined);
    assert.equal(input.previous.apiKey, undefined);
    assert.equal(input.direction, 'editorial');
    assert(!options.body.includes('private-do-not-forward'));
    return envelope(resultPlan({ direction: 'editorial' }));
  } });
  assert.equal((await planner.plan({ brief: 'Give it a stronger opening', references: refs, previous, direction: 'editorial' })).direction, 'editorial');
  const wrong = configured({ fetchImpl: async () => envelope(resultPlan()) });
  await assert.rejects(wrong.plan({ brief: 'Change the direction', references: refs, direction: 'editorial' }), errorIs(502, 'invalid_ai_plan'));
});

test('missing credentials give explicit unconfigured status and never masquerade as AI output', async () => {
  let calls = 0;
  const planner = createAiPlanner({ fetchImpl: async () => { calls++; } });
  assert.deepEqual(planner.status(), { configured: false, provider: 'gemini', model: 'gemini-2.5-flash' });
  await assert.rejects(planner.plan({ brief: 'Build a landing page' }), errorIs(503, 'ai_planner_not_configured'));
  assert.equal(calls, 0);
  assert(!JSON.stringify(configured({}).status()).includes('test-gemini-secret'));
});

test('bad input fails before contacting Gemini', async () => {
  let calls = 0;
  const planner = configured({ fetchImpl: async () => { calls++; } });
  await assert.rejects(planner.plan({ brief: ' ' }), errorIs(400, 'invalid_brief'));
  await assert.rejects(planner.plan({ brief: 'a'.repeat(2401) }), errorIs(400, 'invalid_brief'));
  await assert.rejects(planner.plan({ brief: 'Build it', direction: 'javascript' }), errorIs(400, 'invalid_direction'));
  await assert.rejects(planner.plan({ brief: 'Build it', references: [{ id: '' }] }), errorIs(400, 'invalid_references'));
  await assert.rejects(planner.plan({ brief: 'Build it', references: [refs[0], refs[0]] }), errorIs(400, 'invalid_references'));
  assert.equal(calls, 0);
});

test('arbitrary model HTML, script, CSS, unknown fields and invented references are rejected', async () => {
  const values = [
    resultPlan({ html: '<script>alert(1)</script>' }), resultPlan({ script: 'alert(1)' }),
    resultPlan({ accent: 'red; background:url(https://evil.test)' }), resultPlan({ kind: 'raw-html' }),
    resultPlan({ decisions: [{ id: 'invented', feature: 'search', rationale: 'Invent a source.' }] }),
    resultPlan({ decisions: [{ ...resultPlan().decisions[0], javascript: 'alert(1)' }] }),
    resultPlan({ search: 'true' }), resultPlan({ title: 'x'.repeat(101) }),
    resultPlan({ suggestion: '<script>alert(1)</script>' }),
  ];
  for (const value of values) {
    await assert.rejects(configured({ fetchImpl: async () => envelope(value) }).plan({ brief: 'Build an app', references: refs }), errorIs(502, 'invalid_ai_plan'));
  }
});

test('plain text model content remains escaped inside the compiler-owned security policy', async () => {
  const title = '<img src=x onerror=alert(1)>';
  const plan = await configured({ fetchImpl: async () => envelope(resultPlan({ title })) }).plan({ brief: 'Build an app', references: refs });
  const html = compileArtifact(plan);
  assert(!html.includes('<img src=x'));
  assert(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.equal(verifyArtifact(html, plan).length, 4);
});

test('inconsistent decisions, duplicate IDs and unsupported landing controls fail closed', async () => {
  const values = [
    resultPlan({ search: false }),
    resultPlan({ decisions: [resultPlan().decisions[0], resultPlan().decisions[0]] }),
    resultPlan({ decisions: [{ id: refs[0].id, feature: 'eligibility', rationale: 'Apply to the program.' }] }),
    resultPlan({ kind: 'landing' }),
    resultPlan({ kind: 'landing', search: false, decisions: [], suggestion: 'Add search' }),
  ];
  for (const value of values) {
    await assert.rejects(configured({ fetchImpl: async () => envelope(value) }).plan({ brief: 'Build it', references: refs }), errorIs(502, 'invalid_ai_plan'));
  }
});

test('a landing plan with no relevant references compiles without fabricated citations', async () => {
  const value = resultPlan({ kind: 'landing', profile: 'event', search: false, decisions: [], suggestion: 'Switch to the editorial layout' });
  const plan = await configured({ fetchImpl: async () => envelope(value) }).plan({ brief: 'An event landing page' });
  assert.deepEqual(plan.referenceIds, []);
  assert.equal(plan.decisions.length, 0);
  assert.equal(verifyArtifact(compileArtifact(plan), plan).length, 4);
});

test('provider auth, quota and unavailable errors expose no upstream body or key', async () => {
  for (const [providerStatus, status, code] of [[401, 502, 'ai_planner_auth'], [403, 502, 'ai_planner_auth'], [429, 429, 'ai_planner_quota'], [500, 502, 'ai_planner_rejected']]) {
    const planner = configured({ fetchImpl: async () => new Response('private provider details test-gemini-secret', { status: providerStatus }) });
    await assert.rejects(planner.plan({ brief: 'Build it' }), error => errorIs(status, code)(error) && !error.message.includes('private') && !error.message.includes('test-gemini-secret'));
  }
});

test('blocked, truncated and malformed model outputs are reported instead of silently using a local plan', async () => {
  const responses = [
    [Response.json({ promptFeedback: { blockReason: 'SAFETY' } }), 422, 'ai_plan_blocked'],
    [Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: JSON.stringify(resultPlan()) }] } }] }), 502, 'invalid_ai_plan'],
    [Response.json({ candidates: [{ content: { parts: [{ text: 'not JSON' }] } }] }), 502, 'invalid_ai_plan'],
    [Response.json({ candidates: [] }), 502, 'invalid_ai_plan'],
    [new Response('not JSON'), 502, 'invalid_ai_plan'],
  ];
  for (const [response, status, code] of responses) {
    await assert.rejects(configured({ fetchImpl: async () => response }).plan({ brief: 'Build it' }), errorIs(status, code));
  }
});

test('thought content is excluded from the schema result', async () => {
  const planner = configured({ fetchImpl: async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [
    { thought: true, text: 'This is not part of the JSON response.' }, { text: JSON.stringify(resultPlan()) },
  ] } }] }) });
  assert.equal((await planner.plan({ brief: 'Build it', references: refs })).title, 'Research Desk');
});

test('pre-cancelled and in-flight cancelled plans propagate cancellation without provider detail', async () => {
  const early = new AbortController(); early.abort('private reason');
  await assert.rejects(configured({ fetchImpl: async () => { throw Error('must not run'); } }).plan({ brief: 'Build it', signal: early.signal }), errorIs(499, 'ai_planner_cancelled'));
  const controller = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const planner = configured({ fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true }); started();
  }) });
  const pending = planner.plan({ brief: 'Build it', signal: controller.signal });
  await ready; controller.abort('private reason');
  await assert.rejects(pending, errorIs(499, 'ai_planner_cancelled'));
});

test('timeout and network errors have safe, distinct failure states', async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const planner = configured({ timeoutMs: 5, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }) });
    await assert.rejects(planner.plan({ brief: 'Build it' }), errorIs(504, 'ai_planner_timeout'));
    await assert.rejects(configured({ fetchImpl: async () => { throw Error('test-gemini-secret'); } }).plan({ brief: 'Build it' }), error => errorIs(502, 'ai_planner_unavailable')(error) && !error.message.includes('test-gemini-secret'));
  } finally { clearTimeout(keepAlive); }
});
