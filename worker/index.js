import { handleApi } from './api.mjs';
import { handleAuthRoute } from './auth.mjs';

// Build embeds public assets into this Worker; no credentials enter the bundle.
const ASSETS = __RENTAL_ASSETS__;
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/auth/') || url.pathname==='/api/session') { const response=await handleAuthRoute(request,env); if(response)return response; }
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    // Old bookmarks lead to the single editor in the original workspace.
    if (['/google-tenants.html', '/google-accounts.html'].includes(url.pathname)) {
      return Response.redirect(new URL('/?view=' + (url.pathname.includes('tenants') ? 'tenants' : 'accounts'), url.origin), 302);
    }
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    const asset = ASSETS[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!asset) return new Response('Not found', { status: 404 });
    const body = request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.data), c => c.charCodeAt(0));
    return new Response(body, { headers: {
      'content-type': asset.type,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'content-security-policy': "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
    } });
  },
};
