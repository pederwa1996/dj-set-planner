import { useState } from 'react';
import { Cloud, CloudOff, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { Button, Field, Segmented } from '../../components/ui';
import { createAccount, signIn, signOut } from '../../sync/auth';
import { syncNow, useSync } from '../../sync/syncStore';
import { timeAgo } from '../../sync/timeAgo';

export function AccountSection() {
  const s = useSync();
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (s.status === 'checking') return <p className="text-sm text-muted">Checking account…</p>;

  if (s.user) {
    const status =
      s.status === 'syncing'
        ? 'Syncing…'
        : s.status === 'offline'
          ? 'Offline — changes are saved on this device and upload when you’re back online.'
          : s.status === 'error'
            ? `Last sync failed: ${s.error}`
            : `Everything synced ${timeAgo(s.lastSyncedAt)}.`;
    return (
      <div className="flex flex-col gap-4">
        <div className="card flex flex-wrap items-center gap-4 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent">{s.status === 'offline' ? <CloudOff size={18} /> : <Cloud size={18} />}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm">
              Signed in as <strong className="font-medium">{s.user.username}</strong>
            </div>
            <div className={`text-[13px] ${s.status === 'error' ? 'text-[#f07a7a]' : 'text-muted'}`}>{status}</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void syncNow()} disabled={s.status === 'syncing'}>
              {s.status === 'syncing' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync now
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void signOut()}>
              <LogOut size={14} /> Sign out
            </Button>
          </div>
        </div>
        <p className="text-[13px] text-muted">Sign in with the same username on your phone and computer to see the same library and sets. Signing out keeps the data on this device.</p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'create' && password !== confirm) {
      setError('The passwords don’t match.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'create') await createAccount(username, password);
      else await signIn(username, password);
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4">
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError('');
        }}
        options={[
          { value: 'signin', label: 'Sign in' },
          { value: 'create', label: 'Create account' },
        ]}
      />
      <Field label="Username">
        <input className="input" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. peder" />
      </Field>
      <Field label="Password" hint={mode === 'create' ? 'At least 8 characters. There’s no email reset, so pick one you’ll remember.' : undefined}>
        <input className="input" type="password" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {mode === 'create' && (
        <Field label="Repeat password">
          <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
      )}
      {error && <p className="rounded-xl bg-bad/15 px-4 py-2.5 text-sm text-[#f0a3a3]">{error}</p>}
      <div>
        <Button type="submit" variant="primary" disabled={busy || !username || !password}>
          {busy && <Loader2 size={16} className="animate-spin" />}
          {mode === 'create' ? 'Create account' : 'Sign in'}
        </Button>
      </div>
      <p className="text-[13px] text-muted">
        {mode === 'create'
          ? 'This app allows one account — yours. Tracks you already have on this device are uploaded when you create it.'
          : 'Tracks on this device are merged with what’s already in your account.'}
      </p>
    </form>
  );
}
