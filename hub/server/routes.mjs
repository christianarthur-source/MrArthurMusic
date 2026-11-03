/**
 * Hub API routes, shared by the site's Cloudflare Worker and the Vite dev server.
 * Each handler takes a standard Request (and the Worker env) and returns a Response.
 * Everything except the PIN lock's own sign-in routes needs a device unlocked with the Hub PIN.
 */
import { handleCalendarProxy } from './calendarProxy.mjs';
import { handleClaudeProxy } from './claudeProxy.mjs';
import { handleHubCloud, isSignedIn } from './hubCloud.mjs';
import { handleYouTubeSearch } from './youtubeSearch.mjs';

const signedInOnly = (handler) => async (request, env) =>
  (await isSignedIn(request, env))
    ? handler(request, env)
    : new Response(JSON.stringify({ ok: false, error: 'Please unlock the Hub with your PIN.' }), {
        status: 401,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });

export const HUB_API_ROUTES = {
  '/api/hub/status': handleHubCloud,
  '/api/hub/setup': handleHubCloud,
  '/api/hub/login': handleHubCloud,
  '/api/hub/logout': handleHubCloud,
  '/api/hub/change-pin': handleHubCloud,
  '/api/hub/sync': handleHubCloud,
  '/api/hub/youtube-search': signedInOnly(handleYouTubeSearch),
  '/api/hub/calendar': signedInOnly(handleCalendarProxy),
  '/api/hub/claude': signedInOnly(handleClaudeProxy),
};
