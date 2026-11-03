/**
 * Cloudflare Worker entry for mrarthurmusic.com.
 *
 * Static files (the built site in dist/) are still served directly by Cloudflare: with
 * `run_worker_first: ["/api/*"]` in the Wrangler config, this script only runs for /api/
 * requests, so normal page and loop-library visits stay free and unlimited.
 *
 * Routes:
 *   GET  /api/drive-video?id=<Google Drive file id>  Studio DAW: download a publicly shared Drive video
 *   POST /api/classroom                               student / teacher logins and saved songs (PINs checked here)
 *   POST /api/omr                                     Pro Staff: read a photo/PDF of sheet music into MusicXML (teacher PIN)
 *   POST /api/wolfi                                   Wolfi: accounts, classes and cloud-saved scores (D1 database WOLFI_DB)
 *   /api/hub/*                                        Music Teacher Hub (/Hub/): PIN lock, cloud sync (D1 HUB_DB), YouTube, calendar, Claude, free AI (AI binding) (hub/server)
 */
import { handleDriveVideo } from './driveVideo.mjs';
import { handleClassroom } from '../src/server/classroomCloud.ts';
import { handleOmr } from '../src/server/omr.ts';
import { handleWolfi } from '../src/server/wolfi.ts';
import { HUB_API_ROUTES } from '../hub/server/routes.mjs';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/drive-video') return handleDriveVideo(request);
    if (url.pathname === '/api/classroom') return handleClassroom(request, env);
    if (url.pathname === '/api/omr') return handleOmr(request, env, ctx);
    if (url.pathname === '/api/wolfi') return handleWolfi(request, env);
    if (HUB_API_ROUTES[url.pathname]) return HUB_API_ROUTES[url.pathname](request, env);
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
