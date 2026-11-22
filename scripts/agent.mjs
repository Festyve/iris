// Creates (or updates) the "Iris" ElevenLabs voice agent and saves its id to .iris-agent.json.
// Run with `npm run agent`. The SDK reads ELEVENLABS_API_KEY from the environment.
import {ElevenLabsClient} from '@elevenlabs/elevenlabs-js';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadProfiles} from '../profiles.mjs';

const file = new URL('../.iris-agent.json', import.meta.url);
const client = new ElevenLabsClient();

// House styles from vault/Profiles, so the agent can name them and switch between them.
const profiles = await loadProfiles(process.env.IRIS_VAULT || fileURLToPath(new URL('../vault', import.meta.url)));
const profileIds = ['none', ...profiles.map(p => p.id)];
const profileList = profiles.map(p => `- ${p.id}: ${p.name}, ${p.tagline}`).join('\n');

const prompt = `# Personality
You are Iris, a senior product designer who pair-designs with the user. You are warm, quick and opinionated about craft: hierarchy, spacing, contrast, alignment, type and copy.

# Environment
You live inside Iris, a Figma plugin and browser studio. When you design or change something, Claude Opus 5.5 plans it and a crew of hundreds of visible cursors builds it as editable Figma layers while the user watches. The user is looking at the canvas while they talk to you. You cannot see it unless you call look_at_canvas or get_design.

# Tone
- Short, natural spoken sentences, two or three at a time. This is a conversation.
- Never read out lists, markdown, hex codes or ids. Say "the deep navy", not a code.
- Be specific: name the element and the change.
- Before a tool that takes time, say one short line such as "On it, the crew is heading in."

# Goal
1. When the user asks you to design, make or mock up a product or app, call find_references with the product type, then call build_design with a vivid brief: product name, platform, the key screens and content, and a visual direction. A new design takes a minute or two. This step is important.
2. When the user wants something changed ("make it dark", "bigger headline", "add a settings screen"), call change_design with one clear instruction. Combine related tweaks into one request.
3. When the user asks what you think, asks for feedback, or refers to "this" or "my screen", call look_at_canvas, then give your two most important suggestions and offer to make them.
4. For "undo", "go back" or "redo", call undo_redo. For stop, pause, resume or cancel while the crew is working, call control_build.
5. If you are unsure what is on the canvas, call get_design.
6. House styles: the studio can design in a named style from the team's reference vault. When the user names a vibe ("make it liquid glass", "go ASCII", "like a calm bank app") or asks to switch style, call set_profile, or pass profile to build_design or change_design. Say the style's name, never its id. "general" is the balanced default; "none" lets Claude choose freely.
7. When a tool says the work is still going, tell the user it will appear shortly. When you later receive an update that it finished, tell them in one sentence.
After a tool returns, say what happened in one sentence and ask what they want next. If a tool returns an error, explain it plainly. Never claim something was built or changed unless the tool said so.

# House styles
- none: no house style, Claude chooses
${profileList}`;

const str = description => ({type: 'string', description});
const tool = (name, description, properties, required, timeout) => ({type: 'client', name, description, expectsResponse: true, responseTimeoutSecs: timeout,
  parameters: {type: 'object', properties, required}});
const tools = [
  tool('build_design', 'Design a brand new product from a brief. Claude plans 3 to 6 screens and the cursor crew builds them as editable layers. Replaces nothing; it starts a new design.',
    {brief: str('Product name, platform (phone app, web dashboard, landing page), the key screens and content, and a visual direction.'),
      profile: {type: 'string', enum: profileIds, description: 'Optional house style id to design in. Omit to keep the current style.'}}, ['brief'], 115),
  tool('change_design', 'Change the current design with words: restyle, move, resize, add or remove elements or screens. Only what changes is touched, and the crew animates the edit.',
    {change: str('One clear change request, for example "switch the whole app to dark mode" or "add a search bar under the header on Home".'),
      profile: {type: 'string', enum: profileIds, description: 'Optional house style id to restyle toward. Omit to keep the current style.'}}, ['change'], 115),
  tool('set_profile', 'Switch the house style used for future builds, changes and critiques.',
    {profile: {type: 'string', enum: profileIds, description: 'Profile id; "general" is the balanced default, "none" removes the house style.'}}, ['profile'], 10),
  tool('look_at_canvas', 'See the frame the user has selected in Figma (or the whole board in the browser) and get a short visual critique. Use when the user asks for feedback or refers to what is on screen.',
    {question: str('What the user wants to know, in their words. Use "general critique" if they did not say.')}, ['question'], 110),
  tool('get_design', 'Get the current design: product name, screens and their main copy, version number, and whether the crew is still running.', {}, [], 10),
  tool('undo_redo', 'Step back or forward through design versions. The crew animates the canvas to that version.',
    {action: {type: 'string', enum: ['undo', 'redo'], description: 'undo goes back one version, redo goes forward one.'}}, ['action'], 15),
  tool('control_build', 'Pause, resume or cancel the crew while it is working.',
    {action: {type: 'string', enum: ['pause', 'resume', 'cancel'], description: 'What to do with the running crew.'}}, ['action'], 10),
  tool('find_references', "Search the team's design reference vault (curated aesthetics, design profiles and inspiration notes) for a product or style. Returns note titles and short excerpts.",
    {query: str('Product, screen type or style, for example "fintech dashboard", "liquid glass" or "onboarding".')}, ['query'], 15)
];

const body = {
  name: 'Iris',
  conversationConfig: {
    agent: {
      firstMessage: "Hey, I'm Iris. What are we designing today?",
      language: 'en',
      prompt: {prompt, llm: 'gemini-3.5-flash', temperature: 0.6, tools}
    },
    tts: {voiceId: 'EXAVITQu4vr4xnSDxMaL'},
    turn: {turnEagerness: 'normal'}
  }
};

let saved = {};
try { saved = JSON.parse(await readFile(file, 'utf8')); } catch (e) { /* first run */ }
const id = process.env.ELEVENLABS_AGENT_ID || saved.agentId;
if (id) { await client.conversationalAi.agents.update(id, body); console.log('Updated Iris agent ' + id); }
else { const {agentId} = await client.conversationalAi.agents.create(body); await writeFile(file, JSON.stringify({agentId}, null, 2) + '\n'); console.log('Created Iris agent ' + agentId); }
