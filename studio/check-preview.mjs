// Only the generated document executes in the opaque-origin frame. The probe sends
// a nonce-bound report and has no host capabilities or provider tokens.
export function inspectPreview(html, width) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.sandbox = 'allow-scripts';
    frame.title = 'Checking generated preview';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;top:0;left:-20000px;border:0;height:800px;width:' + width + 'px';
    const id = crypto.randomUUID();
    function finish(error) {
      window.removeEventListener('message', receive);
      clearTimeout(timer);
      frame.remove();
      if (error) reject(Error(error));
      else resolve('Rendered ' + width + 'px · heading, primary control and page width checked');
    }
    function receive(event) {
      if (event.source !== frame.contentWindow || event.data?.probe !== id) return;
      finish(event.data.problem);
    }
    const timer = setTimeout(() => finish('Preview verification timed out.'), 8000);
    window.addEventListener('message', receive);
    const probe = '<script nonce="' + id + '">addEventListener("load",()=>{const control=document.querySelector("[data-primary]");const problem=!document.querySelector("h1")?"Missing page heading":!control||!control.getClientRects().length||control.disabled?"Primary control unavailable":document.documentElement.scrollWidth>innerWidth+1?"Horizontal overflow at "+innerWidth+"px":"";parent.postMessage({probe:'+JSON.stringify(id)+',problem},"*")});<\/script>';
    // Authorize this single-use probe only on the disposable verification copy.
    const inspectionCopy = html.replace("script-src ", "script-src 'nonce-" + id + "' ");
    frame.srcdoc = inspectionCopy.replace(/<\/body>/i, () => probe + '</body>');
    document.body.append(frame);
  });
}
