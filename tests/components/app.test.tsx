import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { GET, POST } from '@/app/api/practice/route';
import { POST as authPOST, DELETE as authDELETE } from '@/app/api/auth/route';
import { env } from '../helpers/cloudflare-workers';
import { createFakeD1 } from '../helpers/fake-d1';
import { choose, selected, setup, type User } from '../helpers/ui';

const AUTH_SECRET = 'test-auth-secret';
const PASSPHRASE = 'test-passphrase';

/**
 * Route the app's fetch calls to the real API handlers backed by SQLite, with a tiny
 * in-memory cookie jar so the real passphrase gate (app/api/auth) is exercised too.
 * Starts pre-authenticated so existing scenarios below still open straight into the app;
 * `signOutFetch`/re-login is exercised by the dedicated "sign-in gate" tests.
 */
let sqlite: ReturnType<typeof createFakeD1>['sqlite'];
let cookieJar: string;
beforeEach(async () => {
  const f = createFakeD1(); env.DB = f.d1; sqlite = f.sqlite;
  env.AUTH_SECRET = AUTH_SECRET;
  env.PRACTICE_PASSPHRASE = PASSPHRASE;
  const { createSessionToken } = await import('@/lib/session');
  cookieJar = `session=${await createSessionToken(AUTH_SECRET)}`;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const target = new URL(url, 'https://fts.test');
    const headers = new Headers(init?.headers);
    if (cookieJar) headers.set('cookie', cookieJar);
    const req = new Request(target, { ...init, headers });
    const res = target.pathname === '/api/auth'
      ? await (req.method === 'DELETE' ? authDELETE() : authPOST(req))
      : await (req.method === 'POST' ? POST(req) : GET(req));
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookieJar = setCookie.startsWith('session=;') ? '' : setCookie.split(';')[0];
    return res;
  }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

async function openApp() {
  const user = setup();
  const utils = render(<Home />);
  await screen.findByText('Progress saved between visits');
  return { user, ...utils };
}
const tab = (user: User, name: string) => user.click(screen.getByRole('tab', { name }));
const panel = (name: string) => screen.getByRole('tabpanel', { name });
const board = () => screen.getByRole('region', { name: 'Interactive guitar fretboard' });

async function createSong(user: User, title: string) {
  await tab(user, 'Song Finisher');
  await user.click(within(panel('Song Finisher')).getByRole('button', { name: 'Add a song' }));
  await user.type(screen.getByPlaceholderText('A song you want to play'), title);
  await user.click(screen.getByRole('button', { name: 'Create song' }));
  await screen.findByRole('heading', { name: title });
}

describe('App shell', () => {
  it('shows connecting, then loaded', async () => {
    render(<Home />);
    expect(screen.getByText('Connecting to your practice…')).toBeInTheDocument();
    expect(await screen.findByText('Progress saved between visits')).toBeInTheDocument();
  });
  it('shows an error when the database is unavailable, and recovers on Retry', async () => {
    const user = setup();
    const db = env.DB; env.DB = undefined;
    render(<Home />);
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
    expect(screen.getByText('Offline — changes cannot be saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log practice' })).toBeDisabled();
    env.DB = db;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Progress saved between visits')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Log practice' })).toBeEnabled();
  });
  it('all three tabs switch', async () => {
    const { user } = await openApp();
    for (const [name, heading] of [['Song Finisher', 'Finish the song.'], ['Lick Notebook', 'Keep the phrases worth remembering.'], ['Fretboard Journey', 'Make the whole neck yours.']]) {
      await tab(user, name);
      expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
      expect(within(panel(name)).getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    }
  });
});

describe('Sign-in gate', () => {
  it('shows the passphrase form instead of the app when not signed in', async () => {
    cookieJar = '';
    render(<Home />);
    expect(await screen.findByPlaceholderText('Passphrase')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Fretboard Journey' })).toBeNull();
  });
  it('shows an error on the wrong passphrase and unlocks the app on the right one', async () => {
    cookieJar = '';
    const user = setup();
    render(<Home />);
    const input = await screen.findByPlaceholderText('Passphrase');
    await user.type(input, 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect passphrase');
    await user.clear(input);
    await user.type(input, PASSPHRASE);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('tab', { name: 'Fretboard Journey' })).toBeInTheDocument();
  });
  it('sign out returns to the passphrase gate', async () => {
    const { user } = await openApp();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByPlaceholderText('Passphrase')).toBeInTheDocument();
  });
  it('a write that finds the session expired mid-use shows the gate instead of a generic error', async () => {
    const { user } = await openApp();
    cookieJar = ''; // simulate the cookie expiring server-side between actions
    await choose(user, 'How did it feel?', 'Comfortable');
    await user.click(screen.getByRole('button', { name: 'Log practice' }));
    expect(await screen.findByPlaceholderText('Passphrase')).toBeInTheDocument();
  });
});

describe('Persistence through the real API', () => {
  it('logged practice survives a reload', async () => {
    const { user, unmount } = await openApp();
    await choose(user, 'How did it feel?', 'Comfortable');
    await user.click(screen.getByRole('button', { name: 'Log practice' }));
    expect(await screen.findByText('Practice logged')).toBeInTheDocument();
    unmount(); await openApp();
    const recent = document.querySelector('.recent') as HTMLElement;
    expect(within(recent).getByText('Find your home notes')).toBeInTheDocument();
    expect(within(recent).getByText('Comfortable')).toBeInTheDocument();
    expect(recent.querySelector('.stats')).toHaveTextContent('1day streak');
  });
  it('songs and licks survive a reload with all their fields', async () => {
    const { user, unmount } = await openApp();
    await createSong(user, 'Little Wing');
    await tab(user, 'Lick Notebook');
    await user.click(screen.getByRole('button', { name: 'Save a lick' }));
    const ed = document.querySelector('.lick-editor') as HTMLElement;
    await user.type(within(ed).getByPlaceholderText(/Slow bend/), 'Double stop');
    await choose(user, 'Status', 'Learned', ed);
    await choose(user, 'Use in song', 'Little Wing', ed);
    await user.click(within(ed).getByRole('button', { name: 'Save lick' }));
    await screen.findAllByText('Lick saved');
    unmount(); const { user: u2 } = await openApp();
    await tab(u2, 'Lick Notebook');
    await u2.click(screen.getByRole('button', { name: /Double stop/ }));
    expect(selected('Status', document.querySelector('.lick-editor') as HTMLElement)).toBe('Learned');
    expect(selected('Use in song', document.querySelector('.lick-editor') as HTMLElement)).toBe('Little Wing');
    expect(sqlite.prepare('SELECT count(*) AS n FROM licks').get()).toEqual({ n: 1 });
  });
  it('shows a conflict when the song was changed in another tab', async () => {
    const { user } = await openApp();
    await createSong(user, 'Contested');
    sqlite.exec('UPDATE songs SET revision = revision + 1'); // another tab saved meanwhile
    await user.type(screen.getByPlaceholderText(/chorus entry/), 'mine');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/changed in another tab/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/chorus entry/)).toHaveValue('mine'); // edits are kept
  });
  it('shows the server validation message', async () => {
    const { user } = await openApp();
    await createSong(user, 'Blank section');
    const name = screen.getByLabelText('Section 1 name');
    await user.clear(name);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Section names cannot be empty')).toBeInTheDocument();
  });
  it('deleting a song unlinks its licks', async () => {
    const { user } = await openApp();
    await createSong(user, 'Doomed');
    await tab(user, 'Lick Notebook');
    await user.click(screen.getByRole('button', { name: 'Save a lick' }));
    const ed = () => document.querySelector('.lick-editor') as HTMLElement;
    await user.type(within(ed()).getByPlaceholderText(/Slow bend/), 'Orphan');
    await choose(user, 'Use in song', 'Doomed', ed());
    await user.click(within(ed()).getByRole('button', { name: 'Save lick' }));
    await tab(user, 'Song Finisher');
    await user.click(screen.getByRole('button', { name: 'Delete song' }));
    await screen.findAllByText('Song deleted');
    await tab(user, 'Lick Notebook');
    expect(selected('Use in song', ed())).toBe('No song yet');
    expect(screen.getByRole('button', { name: /Orphan/ })).not.toHaveTextContent('Doomed');
  });
  it('deleting a lick removes it from the database', async () => {
    const { user } = await openApp();
    await tab(user, 'Lick Notebook');
    await user.click(screen.getByRole('button', { name: 'Save a lick' }));
    await user.type(screen.getByPlaceholderText(/Slow bend/), 'Temp');
    await user.click(screen.getByRole('button', { name: 'Save lick' }));
    await screen.findAllByText('Lick saved');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findAllByText('Lick deleted');
    expect(sqlite.prepare('SELECT count(*) AS n FROM licks').get()).toEqual({ n: 0 });
  });
});

describe('Navigation between features', () => {
  it('unsaved drafts survive switching tabs', async () => {
    const { user } = await openApp();
    await createSong(user, 'Draft test');
    await user.type(screen.getByPlaceholderText(/chorus entry/), 'unsaved words');
    await tab(user, 'Fretboard Journey'); await tab(user, 'Lick Notebook'); await tab(user, 'Song Finisher');
    expect(screen.getByPlaceholderText(/chorus entry/)).toHaveValue('unsaved words');
  });
  it('"Explore this key" opens the fretboard in the song key', async () => {
    const { user } = await openApp();
    await createSong(user, 'Key test');
    await choose(user, 'Key for lead practice', 'F♯ minor', document.querySelector('.song-editor') as HTMLElement);
    await user.click(screen.getByRole('button', { name: /Explore this key/ }));
    expect(screen.getByRole('tab', { name: 'Fretboard Journey' })).toHaveAttribute('aria-selected', 'true');
    expect(selected('Key', board())).toBe('F♯ minor');
  });
  it('Lab "See the position" opens box 1 in the lab key at the right range', async () => {
    const { user } = await openApp();
    await tab(user, 'Lick Notebook');
    await choose(user, 'Pentatonic key', 'A minor');
    await user.click(screen.getByRole('button', { name: 'See the position' }));
    expect(selected('Key', board())).toBe('A minor');
    expect(selected('Position', board())).toBe('Box 1');
    expect(selected('Fret range', board())).toBe('0–12');
  });
  it('Lab key uses high frets for E minor → high range', async () => {
    const { user } = await openApp();
    await tab(user, 'Lick Notebook');
    await choose(user, 'Pentatonic key', 'E minor');
    await user.click(screen.getByRole('button', { name: 'See the position' }));
    expect(selected('Fret range', board())).toBe('12–24');
  });
  it('notebook "Show on fretboard" uses the lick key, box and tab frets', async () => {
    const { user } = await openApp();
    await tab(user, 'Lick Notebook');
    await user.click(screen.getByRole('button', { name: 'Save a lick' }));
    const ed = document.querySelector('.lick-editor') as HTMLElement;
    await choose(user, 'Key', 'D minor', ed);
    await choose(user, 'Position', 'Box 4', ed);
    await user.type(within(ed).getByLabelText(/Tab or note sequence/), 'G|10-12|');
    await user.click(within(ed).getByRole('button', { name: /Show on fretboard/ }));
    expect(selected('Key', board())).toBe('D minor');
    expect(selected('Position', board())).toBe('Box 4');
    expect(selected('Fret range', board())).toBe('0–12');
  });
  it('linked licks in a song open the notebook', async () => {
    const { user } = await openApp();
    await createSong(user, 'With lick');
    await tab(user, 'Lick Notebook');
    await user.click(screen.getByRole('button', { name: 'Save a lick' }));
    const ed = document.querySelector('.lick-editor') as HTMLElement;
    await user.type(within(ed).getByPlaceholderText(/Slow bend/), 'Linked');
    await choose(user, 'Use in song', 'With lick', ed);
    await user.click(within(ed).getByRole('button', { name: 'Save lick' }));
    await tab(user, 'Song Finisher');
    await user.click(screen.getByRole('button', { name: /Open Lick Notebook/ }));
    expect(screen.getByRole('tab', { name: 'Lick Notebook' })).toHaveAttribute('aria-selected', 'true');
  });
  it('the metronome is shared between Journey and Song Finisher', async () => {
    const { user } = await openApp();
    await user.click(screen.getByRole('button', { name: 'Faster by 5 BPM' }));
    await createSong(user, 'Shared');
    expect(within(panel('Song Finisher')).getByLabelText('Metronome tempo')).toHaveValue(80);
  });
});
