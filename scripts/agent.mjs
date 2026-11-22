// Creates (or updates) the "Iris" ElevenLabs voice agent and saves its id to .iris-agent.json.
// Run with `npm run agent`. The SDK reads ELEVENLABS_API_KEY from the environment.
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { readFile, writeFile, readdir } from 'node:fs/promises';

const file = new URL('../.iris-agent.json', import.meta.url);
const client = new ElevenLabsClient();

// Design profiles from vault/Profiles become choices the agent can switch between.
const profiles = [];
try {
  const dir = new URL('../vault/Profiles/', import.meta.url);
  for (const f of (await readdir(dir)).filter(f => f.endsWith('.md'))) {
    const head = (await readFile(new URL(f, dir), 'utf8')).match(/^---\n([\s\S]*?)\n---/);
    if (!head) continue;
    const meta = Object.fromEntries(head[1].split('\n').map(l => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
    if (meta.id) profiles.push(meta);
  }
} catch {}
profiles.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
const profileIds = [...new Set(['none', ...profiles.map(p => p.id)])];
const profileList = profiles.map(p => `- ${p.id}: ${p.name}, ${p.tagline}`).join('\n');

const prompt = `# Personality
You are Iris, a senior product designer who pair-designs with the user while they work in Figma. You are warm, direct and opinionated about craft: hierarchy, spacing, contrast, alignment and type.

# Environment
You are a voice assistant inside the Iris Figma plugin. The user is looking at their Figma canvas while they talk to you. You cannot see the canvas unless you call look_at_canvas. A swarm of up to 100 visible cursors builds and edits editable Figma layers when you call build_screen or refine_design.

# Tone
- Speak in short, natural sentences, two or three at a time. This is a conversation, not a lecture.
- Never read out lists, markdown, hex codes or layer ids. Say "the deep navy" rather than a code.
- Be specific: name the element and the change ("push the price up and make it bolder").
- Before a tool that takes time, say one short line such as "Let me take a look" or "Sending the cursors in".

# Goal
1. When the user asks what you think, asks for feedback, or refers to "this", "my screen" or "the selection", call look_at_canvas first, then give your two most important suggestions. This step is important.
2. When the user asks you to design, build, make or mock up a screen, call find_references with the product type, then call build_screen with a vivid one- or two-sentence brief that includes the product, the platform, the key content and a visual direction. Mention a reference you drew on if one was found.
3. When the user wants the selected design changed, polished, or made responsive, call refine_design with a clear direction. Use mode "grid" only for responsive or breakpoint requests.
4. When the user says stop, wait, pause, resume or cancel during a build, call control_build.
5. After a tool returns, tell the user in one sentence what happened and ask what they want next.
6. Design profiles are house styles drawn from the team's reference vault. When the user names a vibe ("make it liquid glass", "go ASCII", "more like a calm bank app") or asks to switch style, call set_profile, or pass profile to build_screen or refine_design. Call profiles by their name, never their id. "general" is the balanced default; "none" removes any house style.

# Design profiles
- none: no house style
${profileList}
If a tool returns an error, explain it plainly and suggest the next step. Never claim something was built if the tool did not say so.`;

const str = description => ({ type: 'string', description });
const tools = [
  { type: 'client', name: 'look_at_canvas', expectsResponse: true, responseTimeoutSecs: 40,
    description: 'Look at the frame the user has selected (or is working on) in Figma. Returns the frame name, size, its layer names and a short design critique from a vision model. Use whenever the user asks for feedback or refers to what is on screen.',
    parameters: { type: 'object', properties: { question: str('What the user wants to know about the design, in their words. Use "general critique" if they did not say.') }, required: ['question'] } },
  { type: 'client', name: 'build_screen', expectsResponse: true, responseTimeoutSecs: 110,
    description: 'Design and build a brand new editable UI screen in Figma from a brief. The cursor swarm places every layer. Takes up to a minute.',
    parameters: { type: 'object', properties: {
      brief: str('One or two sentences: the product and its name, platform (mobile or desktop), the key content and a visual direction.'),
      cursors: { type: 'string', enum: ['5', '25', '100'], description: 'How many cursors to animate. Default 100.' },
      profile: { type: 'string', enum: profileIds, description: 'Optional design profile id to build in. Omit to keep the current one.' } }, required: ['brief'] } },
  { type: 'client', name: 'refine_design', expectsResponse: true, responseTimeoutSecs: 90,
    description: 'Have the cursor swarm edit the selected Figma frame according to a direction. mode "shared" polishes the frame in place; mode "grid" builds responsive layouts from 320 to 1440 pixels.',
    parameters: { type: 'object', properties: {
      direction: str('The art direction, for example "give the hero more room and tighten the card spacing".'),
      mode: { type: 'string', enum: ['shared', 'grid'], description: 'shared to polish in place, grid for responsive breakpoints.' },
      profile: { type: 'string', enum: profileIds, description: 'Optional design profile id to apply. Omit to keep the current one.' } }, required: ['direction', 'mode'] } },
  { type: 'client', name: 'set_profile', expectsResponse: true, responseTimeoutSecs: 10,
    description: 'Switch the active design profile (house style) used for building, refining and critiquing.',
    parameters: { type: 'object', properties: { profile: { type: 'string', enum: profileIds, description: 'Profile id; "general" is the balanced default, "none" removes the style.' } }, required: ['profile'] } },
  { type: 'client', name: 'control_build', expectsResponse: true, responseTimeoutSecs: 10,
    description: 'Pause, resume or cancel the cursor swarm that is currently running.',
    parameters: { type: 'object', properties: { action: { type: 'string', enum: ['pause', 'resume', 'cancel'], description: 'What to do with the running build.' } }, required: ['action'] } },
  { type: 'client', name: 'find_references', expectsResponse: true, responseTimeoutSecs: 15,
    description: "Search the team's design reference vault (curated, good-looking UI notes) for patterns relevant to a product or screen type. Returns titles and short excerpts.",
    parameters: { type: 'object', properties: { query: str('Product or screen type, for example "fintech dashboard" or "onboarding mobile".') }, required: ['query'] } },
];

const body = {
  name: 'Iris',
  conversationConfig: {
    agent: {
      firstMessage: "Hey, I'm Iris. Want feedback on what you're working on, or should I design something new?",
      language: 'en',
      prompt: { prompt, llm: 'gemini-3.5-flash', temperature: 0.6, tools },
    },
    tts: { voiceId: 'EXAVITQu4vr4xnSDxMaL' },
    turn: { turnEagerness: 'normal' },
  },
};

let saved = {};
try { saved = JSON.parse(await readFile(file, 'utf8')); } catch {}
const id = process.env.ELEVENLABS_AGENT_ID || saved.agentId;
if (id) {
  await client.conversationalAi.agents.update(id, body);
  console.log('Updated Iris agent ' + id);
} else {
  const { agentId } = await client.conversationalAi.agents.create(body);
  await writeFile(file, JSON.stringify({ agentId }, null, 2) + '\n');
  console.log('Created Iris agent ' + agentId);
}
