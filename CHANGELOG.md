# Changelog

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
