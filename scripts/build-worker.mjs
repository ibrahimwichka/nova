import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const assets = {};
function collect(dir, prefix = '') {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const relative = `${prefix}/${item.name}`;
    if (item.isDirectory()) { if (item.name !== 'server' && item.name !== '.openai') collect(path.join(dir, item.name), relative); }
    else {
      const type = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' }[path.extname(item.name)];
      if (!type) throw new Error(`Unsupported asset: ${relative}`);
      assets[relative] = { type, content: readFileSync(path.join(dir, item.name), 'utf8') };
    }
  }
}
collect('dist');
mkdirSync('.generated', { recursive: true });
writeFileSync('.generated/assets.mjs', `export default ${JSON.stringify(assets)};\n`);
mkdirSync('dist/server', { recursive: true });
await build({ entryPoints: ['worker/index.mjs'], outfile: 'dist/server/index.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true });
console.log('Hosted Worker built with embedded client assets and shared D1 storage.');
