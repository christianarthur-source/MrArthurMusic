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
 */
import { handleDriveVideo } from './driveVideo.mjs';
import { handleClassroom } from '../src/server/classroomCloud.ts';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/drive-video') return handleDriveVideo(request);
    if (url.pathname === '/api/classroom') return handleClassroom(request, env);
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
