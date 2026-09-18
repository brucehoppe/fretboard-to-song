# Fretboard to Song

A personal guitar practice app for getting off the "box 1 rut": learn the minor pentatonic across the whole neck, turn it into licks you actually remember, and finish complete songs.

Built with TypeScript, React 19 and [vinext](https://github.com/cloudflare/vinext) on Cloudflare Workers, with progress in Cloudflare D1. All sound is synthesised in the browser with Web Audio; no API keys, microphone or paid services.

## What it does

**Fretboard Journey** — Interactive neck (22 or 24 frets) for all 12 minor keys and the five box shapes. Toggle note names or intervals, the ♭5 blue note, and the neighbouring box. Tap any note to hear it. Six guided exercises (self-assessed) and a scored **Note quiz**: a `?` appears on the neck and you name it, ten per round, with results logged to your history. A metronome with tap tempo and a practice streak sit alongside.

**Lick Notebook** — The Lick Development Lab generates six starter phrase types (question/answer, bend, slide, legato, descending run, motif) in any key. Tab, interval labels and audio are all generated from one note list, so they always agree. Playback includes rhythm, real pitch bends and slides. "Change the ending" swaps the final note, not just the advice. Save any phrase to your notebook with key, box, technique, tab, notes, status and a linked song; search and filter by status.

**Song Finisher** — Break a song into sections, track clean tempo and confidence per section, and check off transitions. A section is *ready* when it's Steady at the target tempo and its entry is smooth. Each section can start the metronome at its tempo and nudge +5 BPM after a clean pass. Reorder, add and remove sections, see licks linked to the song, and log full play-throughs.

## Run locally

Requires Node.js 22.13+ and pnpm (version pinned in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm build                                   # also generates dist/server/wrangler.json

# Apply migrations to the local D1 database, in order:
for f in drizzle/0000_good_nightmare.sql drizzle/0001_shallow_mongu.sql; do
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js \
    d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file "$f"
done

pnpm dev        # dev server with HMR (http://localhost:5173)
pnpm start      # or: run the built Worker locally
```

Checks:

```sh
pnpm test        # music-theory unit tests (node:test, no extra deps)
pnpm typecheck
pnpm lint
```

Hosting/starter details (Sites profiles, auth headers, D1 bindings) are in [docs/STARTER.md](docs/STARTER.md).

## Code map

| Path | Purpose |
|---|---|
| `lib/music.ts` | Pure music theory: pitches, box shapes, blue note, phrase → tab/intervals, lick lab, quiz, practice stats |
| `tests/music.test.ts` | Unit tests for the above (box coverage in all keys, lick correctness, streaks) |
| `app/page.tsx` | App shell: data loading, server writes, tab routing |
| `components/app/` | `journey-tab`, `fretboard`, `note-quiz`, `metronome-panel`, `licks-tab`, `lick-lab`, `songs-tab`, shared `fields` |
| `hooks/` | `use-audio` (synth, phrase playback, metronome), `use-fretboard-view` (remembered view settings), `use-stored-state`, `use-unsaved-warning`, `use-webmcp` |
| `lib/api.ts` | Client for `/api/practice` |
| `app/api/practice/route.ts` | Validated persistence with optimistic revision checks |
| `db/schema.ts`, `drizzle/` | Schema and migrations |

## Limits and next steps

This is a **single-owner** app: everyone who can reach the site shares one repertoire. Before sharing it, add per-user ownership (the starter's `getChatGPTUser()` provides a stable user id; add a `user_id` column and filter every query by it).

Ideas on the roadmap are listed in [CHANGELOG.md](CHANGELOG.md#roadmap).
