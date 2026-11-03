/**
 * Hub API routes, shared by the site's Cloudflare Worker and the Vite dev server.
 * Each handler takes a standard Request and returns a Response.
 */
import { handleCalendarProxy } from './calendarProxy.mjs';
import { handleClaudeProxy } from './claudeProxy.mjs';
import { handleYouTubeSearch } from './youtubeSearch.mjs';

export const HUB_API_ROUTES = {
  '/api/hub/youtube-search': handleYouTubeSearch,
  '/api/hub/calendar': handleCalendarProxy,
  '/api/hub/claude': handleClaudeProxy,
};
