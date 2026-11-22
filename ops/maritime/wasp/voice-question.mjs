// Run explicitly to exercise one ElevenLabs TTS and one Scribe request.
import assert from 'node:assert/strict';
import {createVoiceService} from '../../../voice-service.mjs';
const base = new URL(process.env.REPO_BACKEND_URL);
assert.equal(base.origin,'https://1e4878ee-23cb-40bb-8140-c0ccfc27889f.mtm.sh');
assert.ok(process.env.REPO_QUESTION_TOKEN,'Configure REPO_QUESTION_TOKEN');
const voice=createVoiceService({apiKey:process.env.ELEVENLABS_API_KEY,voiceId:process.env.ELEVENLABS_VOICE_ID});
const question='Which command starts the studio locally?';
const audio=await voice.synthesize({text:question});
const bytes=Buffer.from(await audio.arrayBuffer());
const {text}=await voice.transcribe({bytes,mimeType:audio.headers.get('content-type').split(';')[0]});
const reply=await fetch(new URL('/studio-api/repo/question',base),{method:'POST',redirect:'error',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.REPO_QUESTION_TOKEN},
  body:JSON.stringify({question:text}),signal:AbortSignal.timeout(60000)});
assert.equal(reply.status,200);
const answer=await reply.json();
assert.equal(answer.answer,'npm start');
assert.equal(answer.citations[0].path,'README.md');
console.log(JSON.stringify({question,audioBytes:bytes.length,transcript:text,answer},null,2));
