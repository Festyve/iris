export function localSession() {
  const key = new URLSearchParams(location.hash.slice(1)).get('key');
  if (key) {
    sessionStorage.setItem('studio.voice.session', key);
    history.replaceState(null, '', location.pathname + location.search);
  }
  return key || sessionStorage.getItem('studio.voice.session') || '';
}


export async function studioRequest(key, path, body, signal) {
  if (!key) throw Error('Open the private studio link printed by the local server to use this service.');
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer ' + key, ...(body === undefined ? {} : {'Content-Type':'application/json'}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal
  });
  let data;
  try { data = await response.json(); }
  catch { throw Error('The local service could not return a result. Check that the server is running.'); }
  if (!response.ok) throw Error(data.error || data.message || 'Service returned HTTP ' + response.status);
  return data;
}
