// Browser entry for the ElevenLabs Agents client. build.mjs bundles it into voice.bundle.js,
// which server.mjs serves at /voice.js and ui.html loads on first use.
import { Conversation } from '@elevenlabs/client';
window.IrisVoice = { Conversation };
