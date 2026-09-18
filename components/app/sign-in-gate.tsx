'use client';
import { useState } from 'react';
import { Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signIn } from '@/lib/api';

export function SignInGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passphrase) return;
    setBusy(true);
    setError('');
    try { await signIn(passphrase); onSignedIn(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="sign-in-gate">
      <form className="sign-in-card" onSubmit={submit}>
        <span className="brand-icon"><Music2 size={23} /></span>
        <h1>Fretboard to Song</h1>
        <p>This is a private practice studio. Enter the passphrase to continue.</p>
        <Input type="password" autoFocus value={passphrase} onChange={e => setPassphrase(e.target.value)}
          placeholder="Passphrase" aria-label="Passphrase" disabled={busy} />
        {error && <p role="alert" className="sign-in-error">{error}</p>}
        <Button type="submit" disabled={busy || !passphrase}>{busy ? 'Checking…' : 'Sign in'}</Button>
      </form>
    </div>
  );
}
