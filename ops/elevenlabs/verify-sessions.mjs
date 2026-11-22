// Run against the local server with its ignored .env. Never log session credentials.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clientToolDefinitions} from './agent-config.mjs';

const localKey = (await readFile(new URL('../../.iris-session', import.meta.url), 'utf8')).trim();
const origin = 'http://localhost:' + (process.env.STUDIO_PORT || 4739);
const rootId = process.env.ELEVENLABS_AGENT_ID;
const studioId = process.env.ELEVENLABS_STUDIO_AGENT_ID;
assert.ok(rootId && studioId && rootId !== studioId, 'Configure distinct root and studio agents.');
async function connect(url) {
  const socket = new WebSocket(url);
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error('Conversation initialization timed out.')), 20000);
      socket.onopen = () => socket.send(JSON.stringify({type:'conversation_initiation_client_data'}));
      socket.onmessage = ({data}) => {
        if (JSON.parse(data).type === 'conversation_initiation_metadata') {
          clearTimeout(timeout);
          resolve();
        }
      };
      socket.onerror = socket.onclose = () => {
        clearTimeout(timeout);
        reject(Error('Conversation connection failed.'));
      };
    });
  } finally { socket.close(); }
}
for (const [label,id,path,method] of [
  ['Iris', rootId, '/voice/session', 'GET'],
  ['Studio', studioId, '/eleven-agent/session', 'POST'],
]) {
  const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/' + encodeURIComponent(id), {
    headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY},
  });
  assert.ok(response.ok, label + ' configuration HTTP ' + response.status);
  const config = await response.json();
  const tools = config.conversation_config.agent.prompt.tools.filter(tool => tool.type === 'client');
  if (label === 'Studio') {
    assert.equal(config.platform_settings.auth.enable_auth, true);
    assert.equal(config.platform_settings.privacy.record_voice, false);
    assert.deepEqual(tools.map(t => t.name).sort(), clientToolDefinitions.map(t => t.name).sort());
    for (const expected of clientToolDefinitions) {
      const actual = tools.find(tool => tool.name === expected.name);
      assert.equal(actual.expects_response, true);
      assert.deepEqual(actual.parameters.required || [], expected.parameters.required);
      for (const [name, schema] of Object.entries(expected.parameters.properties)) {
        assert.equal(actual.parameters.properties[name].type, schema.type);
      }
    }
  } else {
    assert.deepEqual(tools.map(t => t.name).sort(), ['build_screen','control_build','find_references','look_at_canvas','refine_design','set_profile']);
  }
  const session = await fetch(origin + path, {method, headers:{Authorization:'Bearer ' + localKey}});
  assert.ok(session.ok, label + ' session HTTP ' + session.status);
  const {signedUrl} = await session.json();
  assert.ok(new URL(signedUrl).searchParams.get('agent_id') === id, label + ' session agent mismatch');
  await connect(signedUrl);
  console.log(label + ' signed WebSocket initialized. Client tools: ' + tools.map(t => t.name).join(', '));
}
