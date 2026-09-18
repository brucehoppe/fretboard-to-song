# Changelog

## 0.5.0 — the five boxes

- New **The five boxes** section on the Fretboard Journey tab, ported from the Minor
  Pentatonic Practice Desk: select any combination of boxes (buttons or cards), a whole-neck
  map that dims everything outside the selection, and five playable cards laid out low to
  high. Its key picker is shared with the main fretboard; Octave down / Standard / Octave up
  registers move each box as far as the neck allows (22 or 24 frets).
- Box tips name their root strings from the shape data rather than by hand, and a test
  checks them in every key and register. (Box 2's roots are on the D and B strings and
  Box 3's on the A and B strings — the practice desk's hand-written tips had these wrong.)
- **Performance.** The metronome's beat lived in page-level React state, so every beat
  re-rendered the whole app (all three tabs, ~600 note buttons). Beats are now published to
  the beat lights only: script time while the metronome runs dropped ~85% (185 → 28 ms over
  4 s at 240 BPM, 4× CPU throttle). Fretboards are memoised and skip re-rendering unless
  something they draw changes. Later note taps respond in ~16 ms; the first tap (~145 ms at
  4× throttle) is the browser creating its audio engine, kept lazy so no audio thread runs
  for visitors who never play a note.

## 0.4.1 — dependency security updates

- Patched every open Dependabot alert (js-yaml, browserslist, baseline-browser-mapping,
  brace-expansion, @babel/core, esbuild, fflate). All are transitive build/dev tooling;
  they're forced to patched versions with range-scoped `overrides` in `pnpm-workspace.yaml`
  that become no-ops once the parent packages catch up.
- React and React DOM 19.3.0 to match `react-server-dom-webpack` 19.3, and
  `@cloudflare/workers-types` v5 for the newer Wrangler; no unmet peer dependencies remain.
- CI actions updated (checkout v7, setup-node v7, upload-artifact v7, pnpm/action-setup v6),
  still SHA-pinned.

## 0.4.0 — security hardening

- **Passphrase sign-in.** `/api/practice` (read and write, including delete) previously had
  no access control at all — anyone who found the URL could read, spam, or permanently
  delete the owner's data. It's now gated by a shared passphrase and a signed (HMAC-SHA256),
  HttpOnly session cookie; the API fails closed if the secrets aren't configured. See
  "Passphrase sign-in" in the README.
- Logged practice sessions used the client-supplied date as the server sort key, so a
  spoofed future-dated session could permanently push real history out of the
  last-200-sessions window. `created_at` is now always server time; the client's date is
  kept only for display.
- Defensive row-count ceilings on the songs/licks queries; deterministic tie-breaking
  (`rowid`) when timestamps collide.
- Per-request Content-Security-Policy with a fresh script nonce (`proxy.ts`), plus
  `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` on API responses.
- CI Actions are now pinned to commit SHAs instead of floating tags; checkout no longer
  persists the token in `.git/config`, and jobs have a 20-minute timeout.
- `app/chatgpt-auth.ts` (unused starter helper) now carries a warning: it trusts request
  headers that are only safe behind OpenAI's Sites dispatch proxy.

## 0.3.1 — portfolio polish
- README with screenshots, badges and an engineering-highlights section; MIT license; `SECURITY.md`.
- CI runs with a read-only token. Dependabot is configured for npm and GitHub Actions, with a 7-day cooldown that matches the pnpm release-age policy.
- The hosting project ID is kept out of the repository (`.openai/hosting.json` is git-ignored; an example file is committed).
- Fix: the Lick Lab's "Build it in three moves" steps are numbered again (a Tailwind reset had removed the numbers).

## 0.3.0 — test suite

### Test suite
- Vitest with three projects (unit, API, components) plus Playwright end-to-end tests: 344 tests in all. Every dropdown option, switch, button and field in the app is exercised.
- The API tests run the real route against SQLite built from the real migrations. The component tests record Web Audio calls, so they check which pitches actually sound.
- Coverage thresholds are enforced in CI (currently ~98% statements, ~96% branches).
- GitHub Actions CI runs typecheck, lint, coverage, build and e2e on every push and pull request.

### Bugs found by the new tests
- **Preferences didn't sync across browser tabs.** The stored-settings hook's in-memory mirror took priority over `localStorage`, so a change in another tab was ignored. Memory is now used only when storage is blocked.
- **A rejected cross-origin POST could crash the local Workers runtime.** The 403 was returned without reading the request body, and the next request on the same kept-alive connection took down `wrangler dev`. The body is now read first. Declared oversize bodies are still refused unread.


## 0.2.0 — review and refactor

### Bugs fixed
- **Lick Notebook could not save on a fresh database.** `drizzle/0001_shallow_mongu.sql` (which creates the `licks` table) was listed in the migration journal but missing from the repo. Restored, using `IF NOT EXISTS` so it is safe where the table was created by hand.
- **Lick Lab labels contradicted the notes.** Four of six phrases had wrong interval labels or step text (e.g. "Slide into the third" actually slid ♭3→4; "Descend and resolve" ended on ♭3, not the root; "Repeat one idea" said the ending changes but both passes were identical). Tab, labels and audio are now generated from one note list, and tests check every move in every key.
- **"Change the ending" only changed a sentence.** It now changes the final note.
- **Switching licks lost work.** Selecting another lick fired a save without waiting, then the save's result overwrote the newly selected lick; a failed save (e.g. empty title) silently discarded edits. Now saves first and asks before discarding.
- **Tempo fields were nearly impossible to type into.** The metronome clamped on every keystroke (typing "1" became 30); song/section tempos accepted blank → 0 and failed server validation. Numbers now commit on blur/Enter.
- **Unsaved lick edits had no leave-page warning**, and drafts were lost when switching tabs.
- Duplicate CSS block removed; pre-existing lint errors fixed.

### Improvements
- `app/page.tsx` split from one 78-line minified component (with ~40 `useState`s) into focused components, hooks and a pure `lib/music.ts`.
- Scored **Note quiz** (active recall) alongside the self-assessed exercises.
- **Blue note (♭5)** toggle, placed per box, plus a new exercise for it.
- Phrase playback with rhythm, real bends/slides, adjustable tempo and stop.
- Metronome: ±5 buttons, tap tempo, visual beat; shared between Journey and Song Finisher.
- Song Finisher: reorder sections, per-section "play at this tempo" and "+5 BPM", next-focus highlight, linked licks, artist editing, delete song.
- Lick Notebook: delete, search notes, status filter, linked song name in the list.
- Practice streak and weekly count; history window raised from 30 to 200 sessions.
- View settings (key, box, range, fret count, toggles) remembered per device.
- Clearer API validation errors; delete endpoints.
- Unit tests (`pnpm test`), `typecheck` script, project README.

## Roadmap
- **Listening mode**: pitch detection from the microphone (autocorrelation/YIN) to score exercises and the quiz by playing, not tapping.
- **Backing tracks**: simple drum + bass loop in the song's key at the section tempo, so licks can be practised in context.
- **Major pentatonic / modes**: relative-major view and Dorian/Aeolian overlays on the same neck.
- **Spaced repetition** for licks: surface "Practising" licks you haven't touched in a while.
- **Multi-user**: `user_id` on every table (see README).
- **Offline/PWA**: cache the app shell and queue writes.
- **Alternate tunings** (Drop D, DADGAD) — `TUNING` is already a single constant.
