import {spawn} from 'node:child_process';
import {readFile, readdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {chromium} from '@playwright/test';
import otlp from '@opentelemetry/otlp-transformer/build/src/generated/root.js';

const server = spawn(process.execPath,['--env-file-if-exists=.env','server.mjs'],{
  env:{...process.env,STUDIO_PORT:process.env.TEST_STUDIO_PORT || '4741'},stdio:['ignore','pipe','inherit']
});
let browser;
try {
  const [output] = await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('Studio did not start');})]);
  const url = String(output).match(/Studio: (\S+)/)?.[1];
  assert.ok(url);
  browser = await chromium.launch(process.env.CHROME_CHANNEL ? {channel:process.env.CHROME_CHANNEL} : {});
  const page = await browser.newPage();
  await page.goto(url);
  await page.getByRole('button',{name:'Write a brief',exact:true}).click();
  const question = 'Which command starts the studio locally?';
  await page.getByRole('textbox',{name:'Design brief or change'}).fill('/repo '+question);
  const response = page.waitForResponse(r=>r.url().endsWith('/repo/question'));
  await page.getByRole('button',{name:'Send',exact:true}).click();
  const reply = await (await response).json();
  assert.equal(reply.answer,'npm start',reply.error);
  assert.match(reply.citations[0].commit,/^[a-f0-9]{40}$/);
  await page.getByText(/README\.md line 10/).waitFor();
  if (process.env.TRACEROOT_LOCAL_CAPTURE === '1' && !process.env.TRACEROOT_API_KEY) {
    assert.equal(reply.trace.destination,'local OTLP');
    const {ExportTraceServiceRequest} = otlp.opentelemetry.proto.collector.trace.v1;
    let seen=false;
    for (const file of await readdir(reply.trace.directory)) {
      const bytes=await readFile(join(reply.trace.directory,file));
      const batch=ExportTraceServiceRequest.decode(bytes[0]===0x1f && bytes[1]===0x8b ? gunzipSync(bytes) : bytes);
      const spans=batch.resourceSpans.flatMap(r=>r.scopeSpans.flatMap(s=>s.spans));
      seen ||= spans.some(s=>s.name==='second-cursor.repo-question' && Buffer.from(s.traceId).toString('hex')===reply.trace.id);
    }
    assert.ok(seen,'Trace ID missing from the exported OTLP batch');
  }
  if (process.env.REPO_DEMO_SCREENSHOT) await page.screenshot({path:process.env.REPO_DEMO_SCREENSHOT});
  console.log(JSON.stringify({question,...reply},null,2));
} finally { await browser?.close(); server.kill(); }
