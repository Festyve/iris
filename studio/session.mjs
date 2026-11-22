export function localSession() {
  const key = new URLSearchParams(location.hash.slice(1)).get('key');
  if (key) {
    sessionStorage.setItem('studio.voice.session', key);
    history.replaceState(null, '', location.pathname + location.search);
  }
  return key || sessionStorage.getItem('studio.voice.session') || '';
}

