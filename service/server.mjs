// A real HTTP server around the reference service, so the checks go over the wire rather than
// calling a function and calling that a test.

import { createServer } from 'node:http';
import { createApp, TODAY } from './app.mjs';
import { loadPolicy } from '../src/policy.mjs';
import { Registry } from '../src/corpus.mjs';

export function startServer({ policy = loadPolicy(), registry = new Registry(), today = TODAY, port = 0 } = {}) {
  const app = createApp({ policy, registry, today });

  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', async () => {
      let body = null;
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          res.writeHead(400, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ error: 'body is not json' }));
        }
      }
      try {
        const out = await app.handle({ url: req.url, method: req.method, headers: req.headers, body });
        res.writeHead(out.status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(out.body));
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal error' }));
        process.emitWarning(`service error: ${e.stack}`);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: bound } = server.address();
      resolve({
        app,
        server,
        origin: `http://127.0.0.1:${bound}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { origin } = await startServer({ port: Number(process.env.PORT ?? 8787) });
  console.log(`reference service on ${origin}`);
}
