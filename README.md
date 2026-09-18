# Fretboard to Song

[![CI](https://github.com/brucehoppe/fretboard-to-song/actions/workflows/ci.yml/badge.svg)](https://github.com/brucehoppe/fretboard-to-song/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Tests](https://img.shields.io/badge/tests-381-brightgreen)

A guitar practice app for getting out of the "box 1 rut": learn the minor pentatonic across the whole neck, turn it into licks you remember, and finish complete songs.

![Interactive fretboard showing A minor blues across all 24 frets](docs/screenshots/fretboard.png)

## Highlights

- **A tested music-theory core.** `lib/music.ts` is pure TypeScript with no framework. Its tests check every key, box shape, string and fret (0–24) against the theory, and every generated lick in every key on both 22- and 24-fret guitars.
- **One source of truth for each phrase.** Tab, interval labels and audio are all generated from a single note list, so they can't drift apart. (An earlier version labelled four of six licks incorrectly for exactly that reason.)
- **Web Audio synthesis with no samples.** Bends and slides are pitch automation on one oscillator, hammer-ons step the pitch, and the metronome uses a look-ahead scheduler so it stays in time when the main thread is busy.
- **Safe concurrent edits.** Every record carries a revision number. A save from a stale browser tab is refused with a clear message, and your unsaved text is kept.
- **Four layers of tests (381 in total).**
  - Unit tests for the theory.
  - API tests against real SQLite built from the real migrations.
  - Component tests that click every control and record which pitches actually sound.
  - Playwright tests in real browsers against the built Cloudflare Worker.
  
  The tests found real bugs, including one that crashed the local Workers runtime (see the [changelog](CHANGELOG.md)).
- **Runs at the edge.** React 19 on Cloudflare Workers via vinext, with D1 (SQLite) for storage and zod validation on every write.

| Song Finisher | Lick Development Lab |
|---|---|
| ![Song sections with tempo, confidence, transitions and readiness progress](docs/screenshots/song-finisher.png) | ![Lick lab showing a bend phrase with generated tab and interval path](docs/screenshots/lick-lab.png) |

| Practice + note quiz | Mobile |
|---|---|
| ![Fretboard with quiz, metronome and practice streak](docs/screenshots/journey.png) | <img src="docs/screenshots/mobile.png" alt="Mobile layout" width="260"> |

## What it does

**Fretboard Journey** — Interactive neck (22 or 24 frets) for all 12 minor keys and the five box shapes. Toggle note names or intervals, the ♭5 blue note, and the neighbouring box. Tap any note to hear it. Six guided exercises (self-assessed) and a scored **Note quiz**: a `?` appears on the neck and you name it, ten per round, with results logged to your history. A metronome with tap tempo and a practice streak sit alongside.

**The five boxes** — Below the practice panels, select any combination of Box 1–5 (by button or by clicking a card) to practise moving between them. A whole-neck map lights up just the selected boxes, in every octave, and dims everything else. Five cards, laid out low to high on the neck, each show the shape's frets, a playable diagram, and a tip naming the strings that hold its roots — computed from the shape, so it's right in every key. The section has its own key picker, shared with the main fretboard, and an Octave down / Standard / Octave up register that moves each box as far as the neck allows (flagging any shape that has no room, and noting when the boxes no longer run 1–5 from low to high).

**Lick Notebook** — The Lick Development Lab generates six starter phrase types (question/answer, bend, slide, legato, descending run, motif) in any key. Tab, interval labels and audio are all generated from one note list, so they always agree. Playback includes rhythm, real pitch bends and slides. "Change the ending" swaps the final note, not just the advice. Save any phrase to your notebook with key, box, technique, tab, notes, status and a linked song; search and filter by status.

**Song Finisher** — Break a song into sections, track clean tempo and confidence per section, and check off transitions. A section is *ready* when it's Steady at the target tempo and its entry is smooth. Each section can start the metronome at its tempo and nudge +5 BPM after a clean pass. Reorder, add and remove sections, see licks linked to the song, and log full play-throughs.

## Run locally

`.openai/hosting.json` holds your hosting project ID and is deliberately not committed. To deploy from a fresh clone, run `cp .openai/hosting.example.json .openai/hosting.json` and fill in `project_id`. Local development, tests and CI work without it.

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

### Passphrase sign-in

`/api/practice` (every read and write, including delete) is gated by a shared passphrase and
a signed session cookie — there is no per-request access without it. Set two secrets before
running locally or deploying; without both, the API fails closed (401 on every request):

```sh
# Local dev (pnpm dev / pnpm start): create .dev.vars at the repo root — it's git-ignored.
cat > .dev.vars <<'EOF'
PRACTICE_PASSPHRASE=choose-your-own-passphrase
AUTH_SECRET=some-long-random-string
EOF

# Production (Cloudflare Worker):
wrangler secret put PRACTICE_PASSPHRASE
wrangler secret put AUTH_SECRET
```

`AUTH_SECRET` signs the session cookie (HMAC-SHA256) and should be a long random value you
generate once, e.g. `openssl rand -base64 32`. Rotating it invalidates all existing sessions.

## Testing

381 automated tests across four layers (367 Vitest + 14 Playwright flows). CI runs all of them on every push (`.github/workflows/ci.yml`).

| Command | What it covers |
|---|---|
| `pnpm test:unit` | Music theory, exhaustively: every key × box × string × fret 0–24, blue-note placement, every Lick Lab move × ending × key × 22/24 frets, tab rendering, quiz pools, streaks. Also the API client. |
| `pnpm test:api` | The real `/api/practice` and `/api/auth` routes against SQLite built from the real `drizzle/` migrations: every action, every validation rule, revision conflicts, deletes, origin/size checks, SQL-injection safety, and the passphrase/session-cookie gate (missing/garbage/expired/wrong-secret tokens, fail-closed when unconfigured). |
| `pnpm test:components` | Every control in jsdom with the real components: each dropdown option, switch, button and field in all three tabs; audio verified by recording the pitches scheduled. Includes whole-app tests where `fetch` hits the real API + SQLite (load errors, retry, reload persistence, conflicts, navigation, the sign-in gate and sign-out). |
| `pnpm test:e2e` | Real Chromium (desktop and a Pixel 7) against the built Worker with a fresh local D1: every key/box/range/guitar, all exercises, a full quiz round, metronome timing, every lick move, the song workflow, a two-tab conflict, the passphrase sign-in flow, and no sideways scrolling on mobile. Requires `pnpm build` first. |
| `pnpm test` | Unit + API + components |
| `pnpm test:coverage` | Same, with coverage thresholds enforced (currently ~98% statements, ~96% branches) |
| `pnpm test:all` | Typecheck, lint, coverage, build, e2e — what CI runs |

First-time e2e setup: `pnpm exec playwright install chromium`.

Test helpers live in `tests/helpers/`: a D1 fake on Node's built-in `node:sqlite`, a recording Web Audio fake, and a Radix-select driver for Testing Library.

Hosting/starter details (Sites profiles, auth headers, D1 bindings) are in [docs/STARTER.md](docs/STARTER.md).

## Code map

| Path | Purpose |
|---|---|
| `lib/music.ts` | Pure music theory: pitches, box shapes, blue note, phrase → tab/intervals, lick lab, quiz, practice stats |
| `tests/` | `unit/`, `api/`, `components/`, `e2e/` and shared `helpers/` (see Testing) |
| `app/page.tsx` | App shell: data loading, server writes, tab routing |
| `components/app/` | `journey-tab`, `fretboard`, `five-boxes`, `note-quiz`, `metronome-panel`, `licks-tab`, `lick-lab`, `songs-tab`, `sign-in-gate`, shared `fields` |
| `hooks/` | `use-audio` (synth, phrase playback, metronome), `use-fretboard-view` (remembered view settings), `use-stored-state`, `use-unsaved-warning`, `use-webmcp` |
| `lib/api.ts` | Client for `/api/practice` and `/api/auth` |
| `lib/session.ts` | Signed session cookie (HMAC-SHA256) for the passphrase gate |
| `app/api/practice/route.ts` | Validated, passphrase-gated persistence with optimistic revision checks |
| `app/api/auth/route.ts` | Passphrase check; sets/clears the session cookie |
| `proxy.ts` | Per-request Content-Security-Policy with a fresh script nonce |
| `db/schema.ts`, `drizzle/` | Schema and migrations |

## Limits and next steps

This is a **single-owner** app: everyone who signs in with the shared passphrase (see
"Passphrase sign-in" above) shares one repertoire — there's no per-user data separation.
Before turning this into a multi-user app, add per-user ownership: the starter's
`getChatGPTUser()` (`app/chatgpt-auth.ts`) provides a stable user id you could add as a
`user_id` column and filter every query by, but read the warning comment at the top of
that file first — it trusts request headers that are only safe behind OpenAI's Sites
dispatch proxy, not if this Worker is ever reachable directly.

Ideas on the roadmap are listed in [CHANGELOG.md](CHANGELOG.md#roadmap).

## License and credits

[MIT](LICENSE) © Bruce Hoppe. Built on the vinext starter, with UI primitives from [shadcn/ui](https://ui.shadcn.com) (MIT). Security reports: see [SECURITY.md](SECURITY.md).
