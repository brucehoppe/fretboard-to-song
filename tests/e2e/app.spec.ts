import { expect, test, type Page } from '@playwright/test';

/*
 * Full-stack tests in a real browser: built Worker + local D1 + real React.
 * Web Audio is wrapped (not replaced) so tests can read which pitches were scheduled.
 */
const NOTES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
// Must match tests/e2e/serve.mjs, which serves the Worker with these as --var.
const PASSPHRASE = 'e2e-test-passphrase';

test.beforeEach(async ({ page }) => {
  // Sign in first so every scenario below sees the app, not the passphrase gate.
  await page.request.post('/api/auth', { data: { passphrase: PASSPHRASE } });
  await page.addInitScript(() => {
    const w = window as unknown as { __freqs: number[]; __errors: string[] };
    w.__freqs = []; w.__errors = [];
    window.addEventListener('error', e => w.__errors.push(String(e.message)));
    const Real = window.AudioContext;
    window.AudioContext = class extends Real {
      createOscillator() {
        const o = super.createOscillator();
        const set = o.frequency.setValueAtTime.bind(o.frequency);
        o.frequency.setValueAtTime = (v: number, t: number) => { w.__freqs.push(v); return set(v, t); };
        const desc = Object.getOwnPropertyDescriptor(AudioParam.prototype, 'value')!;
        Object.defineProperty(o.frequency, 'value', { set(v: number) { w.__freqs.push(v); desc.set!.call(this, v); }, get() { return desc.get!.call(this); } });
        return o;
      }
    } as typeof AudioContext;
  });
  page.on('pageerror', e => { throw e; });
  await page.goto('/');
  // Enabled only once saved data has loaded (the "saved" hint is hidden on phones).
  await expect(page.getByRole('button', { name: 'Log practice' })).toBeEnabled();
});
test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => (window as any).__errors)).toEqual([]);
});

const freqs = (page: Page) => page.evaluate(() => (window as any).__freqs as number[]);
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
// CSS locator on purpose: an open Radix dropdown marks the rest of the page aria-hidden.
const board = (page: Page) => page.locator('.fret-panel');
async function choose(page: Page, label: string, option: string, scope = page.locator('body')) {
  await scope.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('fretboard: every key, position, range and guitar', async ({ page }) => {
  for (const n of NOTES) {
    await choose(page, 'Key', `${n} minor`, board(page));
    await expect(page.locator('.board-caption')).toContainText(`${n} minor`);
    await expect(board(page).locator('.note.root').first()).toHaveText(n);
  }
  for (const box of ['Box 1', 'Box 2', 'Box 3', 'Box 4', 'Box 5', 'All five boxes']) {
    await choose(page, 'Position', box, board(page));
    await expect(board(page).getByRole('combobox', { name: 'Position' })).toHaveText(box);
    await expect.poll(() => board(page).locator('.note').count()).toBeGreaterThan(8);
  }
  for (const g of ['22', '24']) {
    await choose(page, 'Your guitar', `${g} frets`, board(page));
    await choose(page, 'Fret range', `12–${g}`, board(page));
    await expect(board(page).locator('.fret-number').last()).toHaveText(g);
    await choose(page, 'Fret range', `Whole neck · 0–${g}`, board(page));
    await expect(board(page).locator('.fret-number')).toHaveCount(+g + 1);
    await choose(page, 'Fret range', '0–12', board(page));
    await expect(board(page).locator('.fret-number')).toHaveCount(13);
  }
});

test('fretboard: switches, tapping notes, remembered settings', async ({ page }) => {
  await page.getByRole('switch', { name: 'Intervals' }).click();
  await expect(board(page).locator('.note.root').first()).toHaveText('R');
  await page.getByRole('switch', { name: 'Blue note' }).click();
  await expect(board(page).locator('.note.blue').first()).toBeVisible();
  await page.getByRole('switch', { name: 'Hide hints' }).click();
  await expect(board(page).locator('.note').first()).toHaveText('·');
  await page.getByRole('switch', { name: 'Hide hints' }).click();
  await choose(page, 'Position', 'Box 2', board(page));
  await expect(board(page).locator('.note.neighbor').first()).toBeVisible();
  const withNext = await board(page).locator('.note').count();
  await page.getByRole('switch', { name: 'Next box' }).click();
  await expect.poll(() => board(page).locator('.note').count()).toBeLessThan(withNext);
  await expect(board(page).locator('.note.neighbor')).toHaveCount(0);

  await board(page).getByRole('button', { name: /String A, fret 5,/ }).click();
  expect((await freqs(page)).some(f => Math.abs(f - hz(50)) < 0.01)).toBe(true); // D3

  await page.reload();
  await expect(page.getByRole('switch', { name: 'Blue note' })).toBeChecked();
  await expect(board(page).getByRole('combobox', { name: 'Position' })).toHaveText('Box 2');
});

test('exercises: all six set up the board and log practice', async ({ page }) => {
  const names = ['Find your home notes', 'Connect two positions', 'Travel on one string', 'Take it above twelve', 'Make a musical sentence', 'Add the blue note'];
  for (const [i, name] of names.entries()) {
    await choose(page, 'Choose an exercise', `${i + 1}. ${name}`);
    await expect(page.getByRole('heading', { name })).toBeVisible();
  }
  for (const rating of ['Needs work', 'Getting there', 'Comfortable']) {
    await choose(page, 'How did it feel?', rating);
    await page.getByRole('button', { name: 'Log practice' }).click();
    await expect(page.locator('.history-row').first()).toContainText(rating);
  }
  await expect(page.locator('.stats')).toContainText('1day streak');
  await expect(page.locator('.stats')).toContainText('3sessions this week');
});

test('note quiz: a full round, logged', async ({ page }) => {
  await page.getByRole('tab', { name: 'Note quiz' }).click();
  for (let i = 0; i < 10; i++) {
    await expect(board(page).locator('.quiz-target')).toHaveText('?');
    await page.locator('.quiz-answer').first().click();
    await expect(page.locator('.quiz-answer.correct')).toHaveCount(1);
    await page.getByRole('button', { name: /Next note|See result/ }).click();
  }
  await expect(page.locator('.quiz-summary')).toContainText('/ 10');
  await page.getByRole('button', { name: 'Log result' }).click();
  await expect(page.locator('.history-row').first()).toContainText('Note quiz');
});

test('metronome actually clicks, at the chosen tempo', async ({ page }) => {
  const tempo = page.getByLabel('Metronome tempo');
  await tempo.fill('240'); await tempo.press('Enter');
  await page.getByRole('button', { name: 'Start metronome' }).click();
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Stop metronome' }).click();
  const clicks = (await freqs(page)).filter(f => f === 1100 || f === 750);
  expect(clicks.length).toBeGreaterThanOrEqual(5); // ~6 beats at 240 BPM
  expect(clicks).toContain(1100);
  const n = clicks.length; await page.waitForTimeout(600);
  expect((await freqs(page)).filter(f => f === 1100 || f === 750).length).toBe(n);
});

test('lick lab: every move plays and opens in the notebook', async ({ page }) => {
  await page.getByRole('tab', { name: 'Lick Notebook' }).click();
  const moves = ['Ask, then answer', 'Bend into home', 'Slide into the fifth', 'Hammer-on / pull-off', 'Descend and resolve', 'Repeat one idea'];
  for (const move of moves) {
    await choose(page, 'Musical move', move);
    const before = (await freqs(page)).length;
    await page.getByRole('button', { name: 'Hear starter' }).click();
    // Every pick stroke schedules a pitch; slides/bends add glides on the same oscillator.
    await expect.poll(async () => (await freqs(page)).length).toBeGreaterThan(before + 1);
    const stop = page.getByRole('button', { name: 'Stop', exact: true });
    if (await stop.isVisible()) await stop.click(); // may already have finished
    await expect(page.getByRole('button', { name: 'Hear starter' })).toBeVisible();
    for (let e = 2; e <= 3; e++) {
      await page.getByRole('button', { name: 'Change the ending' }).click();
      await expect(page.locator('.lab-count')).toHaveText(`ENDING ${e} OF 3`);
    }
    await page.getByRole('button', { name: 'Change the ending' }).click();
  }
  await page.getByRole('button', { name: 'Open in Lick Notebook' }).click();
  await page.locator('.lick-editor').getByRole('button', { name: 'Save lick' }).click();
  await expect(page.locator('.lick')).toHaveCount(1);
  await page.reload();
  await page.getByRole('tab', { name: 'Lick Notebook' }).click();
  await expect(page.locator('.lick').first()).toContainText('Repeat one idea');
  await page.locator('.lick').first().click();
  
});

test('song finisher: full workflow with persistence', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await page.getByRole('tab', { name: 'Song Finisher' }).click();
  await page.getByRole('button', { name: 'Add a song' }).click();
  await page.getByPlaceholder('A song you want to play').fill('E2E Blues');
  await page.getByRole('button', { name: 'Create song' }).click();
  const editor = page.locator('.song-editor');
  await expect(editor.getByRole('heading', { name: 'E2E Blues' })).toBeVisible();

  await editor.getByLabel('Target BPM').fill('70'); await editor.getByLabel('Target BPM').press('Enter');
  await editor.getByRole('button', { name: 'Move Intro down' }).click();
  await editor.getByRole('button', { name: 'Remove Ending' }).click();
  const verse = editor.locator('.song-section').first();
  await verse.getByRole('button', { name: '+5' }).click();
  await verse.getByRole('button', { name: '+5' }).click();
  await choose(page, 'Confidence', 'Steady', verse);
  await verse.getByRole('button', { name: '70' }).click();
  await expect(page.getByLabel('Metronome tempo').last()).toHaveValue('70');
  await expect(editor.locator('.progress-label')).toContainText('1 of 4 sections ready');
  await editor.getByRole('button', { name: 'Log a full play-through' }).click();
  await expect(editor).toContainText('1 complete play-through');

  await page.reload();
  await page.getByRole('tab', { name: 'Song Finisher' }).click();
  await page.getByRole('button', { name: /E2E Blues/ }).click();
  await expect(editor.getByLabel('Section 1 name')).toHaveValue('Verse');
  await expect(editor.locator('.song-section')).toHaveCount(4);
  await expect(editor).toContainText('1 complete play-through');
  await editor.getByRole('button', { name: 'Delete song' }).click();
  await expect(page.getByRole('button', { name: /E2E Blues/ })).toHaveCount(0);
});

test('two tabs editing the same song: the second save is refused, edits kept', async ({ page, context }) => {
  await page.getByRole('tab', { name: 'Song Finisher' }).click();
  await page.getByRole('button', { name: 'Add a song' }).click();
  await page.getByPlaceholder('A song you want to play').fill('Conflict');
  await page.getByRole('button', { name: 'Create song' }).click();

  const other = await context.newPage();
  await other.goto('/');
  await other.getByRole('tab', { name: 'Song Finisher' }).click();
  await other.getByRole('button', { name: /Conflict/ }).click();
  await other.getByPlaceholder(/chorus entry/).fill('from tab 2');
  await other.getByRole('button', { name: 'Save changes' }).click();
  await expect(other.getByRole('button', { name: 'Saved' })).toBeVisible();

  await page.getByPlaceholder(/chorus entry/).fill('from tab 1');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/changed in another tab/)).toBeVisible();
  await expect(page.getByPlaceholder(/chorus entry/)).toHaveValue('from tab 1');
});

test('five boxes: pick several boxes, change key from the section, hear a card note', async ({ page }) => {
  const section = page.getByRole('region', { name: 'The five boxes' });
  const label = section.locator('.map-label');
  await expect(label).toHaveText('Full neck — all boxes');
  await section.getByRole('button', { name: 'Box 1', exact: true }).click();
  await section.getByRole('button', { name: 'Box 3', exact: true }).click();
  await expect(label).toHaveText('Full neck — Boxes 1 + 3 selected');
  await expect(section.getByRole('article', { name: 'Box 3' })).toHaveClass(/selected/);
  expect(await section.getByRole('group', { name: 'Five boxes neck map' }).locator('.note.dimmed').count()).toBeGreaterThan(0);

  await choose(page, 'Key', 'A minor', section);
  await expect(page.locator('.board-caption')).toContainText('A minor');
  await expect(section.getByRole('article', { name: 'Box 1' }).locator('.box-card-head')).toContainText('fret 5–8');

  await section.getByRole('article', { name: 'Box 1' }).getByRole('button', { name: /^String E, fret 5,/ }).click();
  expect((await freqs(page)).some(f => Math.abs(f - hz(45)) < 0.01)).toBe(true); // A2, low E fret 5
  await expect(label).toHaveText('Full neck — Boxes 1 + 3 selected');
  await section.getByRole('button', { name: 'Show all' }).click();
  await expect(label).toHaveText('Full neck — all boxes');
});

test('API rejects cross-origin writes', async ({ request }) => {
  const r = await request.post('/api/practice', { headers: { origin: 'https://evil.example' }, data: { type: 'session', data: {} } });
  expect(r.status()).toBe(403);
});

test('API rejects reads and writes without a signed-in session', async ({ request }) => {
  expect((await request.get('/api/practice', { headers: { cookie: '' } })).status()).toBe(401);
  expect((await request.post('/api/practice', { headers: { cookie: '' }, data: { type: 'session', data: {} } })).status()).toBe(401);
});

test('sign-in gate: wrong passphrase shows an error, correct passphrase unlocks the app', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/');
  await expect(page.getByPlaceholder('Passphrase')).toBeVisible();
  await page.getByPlaceholder('Passphrase').fill('not-it');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect passphrase');
  await page.getByPlaceholder('Passphrase').fill(PASSPHRASE);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('tab', { name: 'Fretboard Journey' })).toBeVisible();
});

test('mobile layout fits the screen @mobile', async ({ page }) => {
  for (const tab of ['Fretboard Journey', 'Song Finisher', 'Lick Notebook']) {
    await page.getByRole('tab', { name: tab }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${tab} scrolls sideways`).toBeLessThanOrEqual(1);
  }
  await page.getByRole('tab', { name: 'Fretboard Journey' }).click();
  await board(page).getByRole('button', { name: /String E, fret 0,/ }).click();
  expect((await freqs(page)).length).toBeGreaterThan(0);
});
