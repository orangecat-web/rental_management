import {handleApi} from './api.mjs';
import {handleAuthRoute} from './auth.mjs';
/** External entry: native static assets, managed Access login and the same signed Google gateway. */
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(env.AUTH_MODE!=='cloudflare-access')return new Response('Authentication is not configured.',{status:503});
 if(url.pathname.startsWith('/auth/')||url.pathname==='/api/session'){const response=await handleAuthRoute(request,env);if(response)return response;}
 if(url.pathname.startsWith('/api/'))return handleApi(request,env);
 if(['/google-tenants.html','/google-accounts.html'].includes(url.pathname))return Response.redirect(new URL('/?view='+(url.pathname.includes('tenants')?'tenants':'accounts'),url.origin),302);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 return env.ASSETS.fetch(request);
}};
