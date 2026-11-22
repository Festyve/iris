import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Accept OTLP from this process's TraceRoot SDK. Keep its exact protobuf export
// for offline inspection when no hosted project credential has been supplied.
export async function startLocalCollector() {
  const directory = await mkdtemp(join(tmpdir(),'second-cursor-traces-'));
  const secret = randomBytes(32).toString('hex');
  const server = createServer(async (req,res) => {
    if (req.url !== '/traces' || req.method !== 'POST' || req.headers.authorization !== 'Bearer '+secret) {
      res.writeHead(403).end(); return;
    }
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1000000) { res.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      await writeFile(join(directory,randomBytes(12).toString('hex')+'.otlp'),Buffer.concat(chunks),{mode:0o600});
      res.writeHead(200,{'Content-Type':'application/x-protobuf'}).end();
    } catch { res.writeHead(500).end(); }
  });
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  server.unref();
  return { directory, close:()=>server.close(), config:{
    baseUrl:'http://127.0.0.1:'+server.address().port,
    internalExport:{path:'/traces',projectId:'second-cursor-local',headers:{Authorization:'Bearer '+secret}}
  }};
}
