import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const outputCaps = Object.freeze({plan:1536, poster:1536, screen:4096, critique:384, irisBoard:8192, irisCritique:1536});
const operations = new Map([
  ['/board',['model-output',outputCaps.irisBoard,16384]], ['/critique',['model-output',outputCaps.irisCritique,16384]],
  ['/studio-plan',['model-output',outputCaps.plan,16384]], ['/design',['model-output',outputCaps.poster,16384]],
  ['/swarm',['model-output',outputCaps.poster,16384]], ['/screen',['model-output',outputCaps.screen,16384]],
  ['/persona-review',['model-output',3*outputCaps.critique,16384]],
  ['/voice',['transcriptions',1,12]], ['/speech',['speech-requests',1,24]],
  ['/eleven-agent/session',['agent-sessions',1,4]], ['/repo/tasks',['repo-tasks',1,4]],
  ...['company','audience','decision','memory','identity','repo-permission'].map(tool =>
    ['/project-tools/'+tool,['external-tool-calls',1,24]])
]);

// A single SQLite statement admits a request across concurrent studio processes.
// Reserve the full allowance even after timeout: the provider may have completed the call.
export function openBudget(file = join(homedir(),'.second-cursor','usage.sqlite'), now = () => new Date()) {
  if (file !== ':memory:') mkdirSync(dirname(file),{recursive:true,mode:0o700});
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS usage(day TEXT, bucket TEXT, reserved INTEGER NOT NULL, PRIMARY KEY(day,bucket))');
  const reserve = db.prepare('INSERT INTO usage VALUES(?,?,?) ON CONFLICT(day,bucket) DO UPDATE SET reserved=reserved+excluded.reserved WHERE reserved+excluded.reserved<=?');
  const date = () => now().toISOString().slice(0,10);
  return {
    admit(path) {
      const op=operations.get(path);
      if (!op) return true;
      const [bucket,units,limit]=op;
      return reserve.run(date(),bucket,units,limit).changes===1;
    },
    status() {return {day:date(), timeZone:'UTC', buckets:[...new Map([...operations.values()].map(([bucket,,limit])=>[bucket,limit]))].map(([bucket,limit])=>({
      bucket,limit,reserved:db.prepare('SELECT reserved FROM usage WHERE day=? AND bucket=?').get(date(),bucket)?.reserved || 0
    }))};},
    close:()=>db.close()
  };
}
