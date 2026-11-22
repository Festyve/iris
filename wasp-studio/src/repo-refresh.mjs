import {snapshot} from './repo-evidence.mjs';
import {indexSources,paths} from './repo-index.mjs';

export function createReader(fetchImpl=fetch,now=Date.now) {
  let current=snapshot, freshness='bundled', next=0, pending;
  async function read(url) {
    const response=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(4500),headers:{'User-Agent':'second-cursor-reader'}});
    if(!response.ok) throw Error('Source unavailable');
    return response;
  }
  async function refresh() {
    try {
      const {sha}=await (await read('https://api.github.com/repos/Festyve/iris/commits/main')).json();
      if(!/^[a-f0-9]{40}$/.test(sha)) throw Error('Invalid revision');
      if(sha!==current.commit) {
        const files=await Promise.all(paths.map(async path=>[path,await (await read('https://raw.githubusercontent.com/Festyve/iris/'+sha+'/'+path)).text()]));
        current=indexSources(sha,Object.fromEntries(files));
      }
      freshness='verified-main'; next=now()+300000;
    } catch {freshness='last-known'; next=now()+60000;}
  }
  return async () => {
    if(now()>=next) {
      pending ??= refresh().finally(()=>{pending=undefined;});
      await pending;
    }
    return {...current,freshness};
  };
}
export const currentSnapshot=createReader();
