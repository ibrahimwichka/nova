import http from 'node:http';
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { initialState, fail } from './domain.mjs';
import { memoryPresenceStore } from './presence.mjs';
import { createApi } from './api.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.NOVA_DATA_DIR || path.join(ROOT, '.data');
const file = path.join(DATA_DIR, 'state.json');
mkdirSync(DATA_DIR, { recursive: true });
let state;
try { state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : initialState(); }
catch { throw new Error('Saved state could not be read. Preserve .data/state.json and restore a valid copy before restarting.'); }
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const api = createApi({ presence: memoryPresenceStore(), env: process.env, extraConfig: { lanEnabled: host === '0.0.0.0', lanUrls: Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => `http://${i.address}:${port}`) }, store: {
  async load() { return structuredClone(state); },
  async save(next, revision) {
    if ((state.revision || 1) !== revision) fail('Another device updated the restaurant. Please retry your action.', 409);
    writeFileSync(`${file}.tmp`, JSON.stringify(next), { mode: 0o600 }); renameSync(`${file}.tmp`, file); state = next;
  },
} });
let vite;
const production = process.argv.includes('--production');
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 7_000_000) { res.writeHead(413, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Request too large.' })); } chunks.push(chunk); }
      const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) });
      const response = await api(request); res.writeHead(response.status, Object.fromEntries(response.headers)); return res.end(Buffer.from(await response.arrayBuffer()));
    }
    if (!production) return vite.middlewares(req, res, () => { res.statusCode = 404; res.end('Not found'); });
    const root = path.join(ROOT, 'dist'); let filename = path.resolve(root, `.${decodeURIComponent(pathname)}`);
    if (!filename.startsWith(`${root}${path.sep}`) && filename !== root) fail('Not found.', 404);
    if (!path.extname(filename)) filename = path.join(root, 'index.html');
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf' };
    const content = await readFile(filename); res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' }); res.end(content);
  } catch (error) { if (res.headersSent) return res.end(); res.writeHead(error.status || (error.code === 'ENOENT' ? 404 : 500), { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error.status ? error.message : 'The server could not complete this request.' })); }
});
if (!production) { const { createServer } = await import('vite'); vite = await createServer({ root: ROOT, configFile: false, server: { middlewareMode: true, hmr: { server } }, appType: 'spa' }); }
server.listen(port, host, () => { console.log(`Nova Kitchen ready: http://localhost:${port}`); console.log(`Vision: ${process.env.OPENROUTER_API_KEY ? 'OpenRouter configured' : 'demo/manual mode'}`); if (host === '0.0.0.0') for (const list of Object.values(os.networkInterfaces())) for (const iface of list || []) if (iface.family === 'IPv4' && !iface.internal) console.log(`Team view: http://${iface.address}:${port}`); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await vite?.close(); server.close(() => process.exit(0)); });
