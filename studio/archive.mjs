// Fixed loopback Wasp API. A browser cannot select an upstream URL or credential.
const archiveOrigin = process.env.WASP_BACKEND_URL || 'http://127.0.0.1:3002';

export async function archiveRoute(path, payload, signal) {
  const origin = new URL(archiveOrigin);
  if (origin.protocol !== 'http:' || !['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) {
    throw Error('Wasp archive must use a loopback HTTP origin.');
  }
  const headers = { 'Content-Type':'application/json' };
  if (process.env.WASP_STUDIO_TOKEN) headers.Authorization = 'Bearer ' + process.env.WASP_STUDIO_TOKEN;
  try {
    const response = await fetch(new URL('/studio-api/' + path, origin.origin), {
      method:payload === undefined ? 'GET' : 'PUT', headers, redirect:'error',
      body:payload === undefined ? undefined : JSON.stringify(payload),
      signal:AbortSignal.any([signal, AbortSignal.timeout(2500)])
    });
    return {status:response.status, data:await response.json()};
  } catch {
    return {status:503, data:{error:'Wasp archive unavailable on the configured loopback port. Your local copy stays on this device.'}};
  }
}
