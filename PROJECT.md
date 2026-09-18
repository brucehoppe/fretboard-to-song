# Fretboard to Song

A personal guitar practice app written in **TypeScript**, using React and a Vinext/Cloudflare Workers web runtime. Styling is CSS; structured progress is stored in Cloudflare D1 (SQLite). Browser Web Audio synthesizes note tones and a metronome. No LLM, API key, microphone, or paid music service is required.

## Included

- All 12 minor pentatonic keys and five box shapes, standard tuning, frets 0–24.
- Roots, intervals, neighboring boxes, high-neck view, hidden hints, and tappable note audio.
- Five guided exercises and self-assessed practice history.
- Add songs, edit sections and clean tempos, assess transitions, save notes, and log complete runs.
- Personal Lick Notebook: save key, box, technique, tab, memory notes, status, and an optional song link.
- Lick Development Lab: six starter phrase types in every minor pentatonic key, including hammer-ons and pull-offs, audible playback, a guided variation prompt, and handoff to the notebook or matching fretboard position.
- Server-side validation and optimistic revision checks to prevent silent overwrites between tabs.

This is a single-owner app deployed privately. Before sharing it with multiple people, add per-user authentication and record ownership; the current database is one repertoire for the site.

## Run and extend

Use Node.js 22.13+ and the pnpm version declared in package.json. Keep pnpm-lock.yaml. Install with `pnpm install --frozen-lockfile`, then build with `pnpm build`. For local D1 setup and the supported development runtime, see README.md. Apply `drizzle/0000_good_nightmare.sql` to the local database as described there. `pnpm dev` is the standalone development command; managed Sites previews use `sites-preview`.

Main code:

- `app/page.tsx`: interface, practice workflow, note synthesis, metronome.
- `app/globals.css`: responsive dark theme and horizontal fretboard.
- `lib/music.ts`: pitch mapping, five shapes, and shared data types.
- `app/api/practice/route.ts`: validated song and practice persistence.
- `db/schema.ts` and `drizzle/`: schema and generated migrations.

TypeScript is the best language for continuing this app because both the interface and server are TypeScript. Python would be useful later for offline audio analysis, but is unnecessary for this version.

## Use

Start with Fretboard Journey: choose a key, select an exercise, and play on your guitar. Click the note circles for reference tones. Exercises are self-assessed, not automatically scored. Log practice when finished. The app does not include backing tracks, tab libraries, transcription, or recording analysis.

In Lick Notebook, begin with Lick Development Lab when you need a starting point. Choose the key and a musical move, hear the starter, then change only one ending detail. Open it in the notebook to edit, practise, and save it. You can also save any phrase directly with its key, box, technique, tab or note sequence, and what you want to remember. Use Show on fretboard to return to the matching neck view, or attach the lick to a song.

In Song Finisher, add a song you know. Edit the starter sections to match its arrangement. A section counts as ready when it is marked Steady at or above your target BPM and its entry transition is checked (the first section needs no incoming transition). Use Save changes after editing. Log full play-through also saves current edits.

Progress is stored on the server. A reload returns to the fretboard; open Song Finisher and select your song to resume. There is no offline mode.

## Validation

- TypeScript check and production build passed.
- Independently checked five-box coverage against minor pentatonic intervals for every string, fret 0–24, and all 12 keys.
- Browser testing covers practice logging, song creation, edited tempo/notes, and saved full runs across reloads.
- Desktop visual layout inspected. Mobile styles are provided; a physical phone/audio-output check remains useful.
- Optional WebMCP tool `configure_fretboard` is feature-detected. This preview browser does not expose document.modelContext, so live WebMCP validation was unavailable. Normal UI controls do not depend on it.
