# Mr. Arthur's Music Lab

The website at mrarthurmusic.com: music tools and games for elementary and middle-school classrooms.

- **Music Lab landing page and tools** (`src/`): Staff Composer, Beat Machine, Studio DAW (`src/daw`), Staff Wars, Rhythm Rock Stars and the Tool Box mini-tools. React + Vite + Tailwind.
- **Wolfi** (`src/prostaff`): advanced notation editor at `/wolfi`.
- **The Staff Room** (`hub/`): teacher planning area at `/Hub/` (its own Vite app, built into `dist/Hub`).
- **Plain HTML sub-sites** in `public/`: `midimusic/`, `chromeextra/`, `conductor/`, `Dentichorus/`.
- **Server** (`cloudflare/worker.mjs`, `src/server/`): a Cloudflare Worker for `/api/*`; everything else is static files from `dist/`.
- `public/_headers` sets caching and security headers; `public/fonts/` holds the self-hosted fonts.

## Run and check

```
npm install
npm run dev          # local site (the classroom API is a development stand-in)
npx tsc --noEmit     # type check
npm run build        # site + Hub into dist/
for t in cloudflare/*.test.mjs; do node $t; done   # server tests
```

## Deploy

Cloudflare Workers Builds deploys from GitHub: a push to `main` goes live, other branches get a preview URL.
