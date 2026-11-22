import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';

const poster = new URL('./ui.html', import.meta.url);
export default defineConfig({
  base: '/studio/',
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
