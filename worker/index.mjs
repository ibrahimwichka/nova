import { createApi } from '../server/api.mjs';
import { d1PresenceStore } from '../server/presence.mjs';
import { createD1Store } from '../server/d1-store.mjs';
import assets from '../.generated/assets.mjs';


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (!env.DB) return Response.json({ error: 'Shared storage is not configured.' }, { status: 503 });
      return createApi({ store: createD1Store(env.DB), presence: d1PresenceStore(env.DB), env, extraConfig: { hosted: true, lanEnabled: false } })(request);
    }
    const asset = assets[url.pathname] || (!url.pathname.split('/').pop().includes('.') ? assets['/index.html'] : null);
    if (!asset) return new Response('Not found', { status: 404 });
    const content = asset.binary ? Uint8Array.from(atob(asset.content), char => char.charCodeAt(0)) : asset.content;
    return new Response(content, { headers: { 'Content-Type': asset.type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' } });
  },
};
