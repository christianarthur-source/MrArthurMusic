import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';
import { HUB_API_ROUTES } from './server/routes.mjs';

/**
 * Runs the Hub's /api/hub/* handlers (server/*.mjs) inside the Vite dev server, so `npm run dev`
 * behaves like the site's Cloudflare Worker. The handlers speak standard Request/Response;
 * this adapter converts Node's req/res to and from them.
 */
function hubApiPlugin(): Plugin {
  return {
    name: 'hub-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const handler = HUB_API_ROUTES[url.pathname as keyof typeof HUB_API_ROUTES];
        if (!handler) return next();

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && chunks.length > 0;

          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value);
            else if (Array.isArray(value)) headers.set(key, value.join(', '));
          }

          const response: Response = await handler(
            new Request(url, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined })
          );

          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Hub API error' }));
        }
      });
    }
  };
}

export default defineConfig({
  base: '/Hub/',
  plugins: [react(), hubApiPlugin()],
  server: {
    port: 5173,
    host: true
  }
});
