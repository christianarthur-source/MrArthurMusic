# Pro Staff (`/prostaff`)

The advanced notation editor for high school and college students. It is not linked from the
classroom Music Lab yet; `src/main.tsx` renders it only when the path starts with `/prostaff`, and
all of its code (including the ~8 MB Verovio engine) loads lazily on that path, so the rest of the
site is unaffected.

## How it works

- **Score data** is an MEI 5 XML document (`model/score.ts`). MEI can express modern and historical
  notation (multiple voices, tuplets, lyrics, chord symbols, repeats, endings, ornaments, mensural and
  neume notation), so imported scores keep their detail.
- **Engraving** is done by [Verovio](https://www.verovio.org) (`engine/verovio.ts`, LGPL-3.0, loaded
  from npm). Every element keeps its `xml:id` in the SVG, so clicks map straight back to the data.
- **Editing** commands live in `model/edit.ts`. They mutate the MEI in place; the editor snapshots
  the document before each command for undo. Durations are counted in ticks (quarter = 960). After
  an edit the changed layer is re-beamed and its accidentals re-spelled from each note's real pitch.
- **Playback** (`audio/`) uses Verovio's timemap for timing. Sound comes from the MuseScore_General
  SoundFont (MIT; `public/audio/soundfont`, split in two because Cloudflare limits files to 25 MiB)
  played by spessasynth (Apache-2.0) in an AudioWorklet — the same approach as MuseScore 3. It loads
  on the first Play and the browser caches it; if it cannot load, the site's CC0 samples are used.
  Dynamics, hairpin swells, slur legato, articulations, sustain pedal and transposition are applied.
  The mixer (per part volume/pan/reverb/mute/solo, master volume/hall reverb/tone) is saved per score.
- **Files** (`io/`): MusicXML (.musicxml/.xml/.mxl), MEI and ABC import; MusicXML, MEI, MIDI, SVG
  and print-to-PDF export; scores autosave to IndexedDB in the browser.
- **Sheet-music scanning** (`io/omr.ts` + `src/server/omr.ts`): photos, scans or PDFs are sent page
  by page to `POST /api/omr` on the Cloudflare Worker, which asks Claude (`claude-opus-5-5`) to
  transcribe the page into MusicXML. Pages are merged and imported as an editable score. The route
  needs the Worker secret `ANTHROPIC_API_KEY` and a teacher (or master) PIN, because each page
  costs API credit.

## Tests

- `node cloudflare/omr.test.mjs` — the scanning endpoint against a fake Anthropic API.
- `node cloudflare/classroom.test.mjs` — the classroom backend (unchanged by Pro Staff).
- In development, `window.__prostaff` exposes the score and toolkit for scripted browser checks.

## Not done yet (ideas for later)

- Cloud saving / sharing and classroom accounts (scores are local to the browser for now).
- Guitar tablature, drum-set note entry by instrument name, figured bass.
- Live MIDI keyboard step-entry, audio/MP3 export, comments and real-time collaboration.
- Playback of repeats/endings and swing; rebarring when a time signature changes.
