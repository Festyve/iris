import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);

async function run(command,args) {
  const child = spawn(command,args,{cwd:root,stdio:'inherit'});
  const [code] = await once(child,'exit');
  if (code !== 0) throw Error(command + ' exited with status ' + code);
}

async function ready(base,path,expected) {
  try {
    const response = await fetch(base + path, {signal:AbortSignal.timeout(1200)});
    return response.ok && (await response.text()).includes(expected);
  } catch { return false; }
}

await run(process.execPath,['build.mjs']);
await run(process.execPath,['node_modules/vite/bin/vite.js','build']);
const children = [];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    try { process.kill(-child.pid,'SIGTERM'); } catch { child.kill('SIGTERM'); }
  }
}
process.on('SIGINT',stop);
process.on('SIGTERM',stop);
if (!await ready('http://127.0.0.1:3002','/studio-api/health','"wasp"')) {
  // The Wasp subprocess needs only its archive configuration. Keep voice and
  // model credentials inside the Node service that owns the provider calls.
  const env = Object.fromEntries(['HOME','USER','LOGNAME','TMPDIR','LANG','TERM','WASP_STUDIO_TOKEN','WASP_CLI_JS']
    .filter(name=>process.env[name]).map(name=>[name,process.env[name]]));
  env.PATH = dirname(process.execPath) + ':' + process.env.PATH;
  const archive = spawn('sh',['start-local.sh'],{cwd:root+'/wasp-studio',env,stdio:'inherit',detached:true});
  children.push(archive);
  archive.on('exit', code=>{if (code && !stopping) console.error('Wasp archive exited. The studio keeps saving locally.');});
}
if (!await ready('http://localhost:4739','/studio/','Second Cursor')) {
  const server = spawn(process.execPath,['--env-file-if-exists=.env','--env-file-if-exists=.env.local','server.mjs'],{cwd:root,stdio:'inherit',detached:true});
  children.push(server);
  server.on('exit',code=>{ stop(); process.exitCode=code ?? 0; });
} else {
  console.log('Studio already running at http://localhost:4739/studio/. Use its printed session link for integrations.');
}
