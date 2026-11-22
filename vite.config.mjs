import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';

const poster = new URL('./poster-adapter/ui.html', import.meta.url);
export default defineConfig({
  base: '/studio/',
  build: { rolldownOptions: { onLog(level, log, forward) {
    // This entry is entirely client-side. React server directives in bundled
    // dependencies have no effect here.
    if (log.code === 'MODULE_LEVEL_DIRECTIVE' && log.message.includes('use client')) return;
    forward(level, log);
  } } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true },
  plugins: [{
    name: 'editable-poster',
    configureServer(server) {
      server.middlewares.use('/studio/poster.html', async (_req, res, next) => {
        try {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(await readFile(poster));
        } catch (error) { next(error); }
      });
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'poster.html', source: await readFile(poster) });
    }
  }]
});
