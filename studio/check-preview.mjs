// Only the generated document executes in the opaque-origin frame. The probe sends
// a nonce-bound report and has no host capabilities or provider tokens.
export function inspectPreview(html, width) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.sandbox = 'allow-scripts';
    frame.title = 'Checking generated preview';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;z-index:-1;border:0;height:800px;width:' + width + 'px';
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
    function inspect(id, width) {
      const checkLayout = () => {
        if (innerWidth !== width) { requestAnimationFrame(checkLayout); return; }
        const control = document.querySelector('[data-primary]');
        let problem = '';
        if (!document.querySelector('h1')) problem = 'Missing page heading';
        else if (!control || !control.getBoundingClientRect().height || control.disabled) problem = 'Primary control unavailable at ' + width + 'px';
        else if (document.documentElement.scrollWidth > innerWidth + 1) problem = 'Horizontal overflow at ' + width + 'px';
        parent.postMessage({ probe: id, problem }, '*');
      };
      addEventListener('load', () => requestAnimationFrame(checkLayout));
    }
    const probe = '<script nonce="' + id + '">(' + inspect.toString() + ')(' +
      JSON.stringify(id) + ',' + width + ');<\/script>';
    // Authorize this single-use probe only on the disposable verification copy.
    const inspectionCopy = html.replace("script-src ", "script-src 'nonce-" + id + "' ");
    frame.srcdoc = inspectionCopy.replace(/<\/body>/i, () => probe + '</body>');
    document.body.append(frame);
    frame.getBoundingClientRect(); // Size the browsing context before its load check.
  });
}
