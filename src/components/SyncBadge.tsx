import { useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { href } from '../lib/router';
import { syncNow, useSync } from '../sync/syncStore';
import { timeAgo } from '../sync/timeAgo';

/** Liten statuslinje for synkronisering (i sidemenyen) */
export function SyncBadge() {
  const s = useSync();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (s.status === 'checking') return null;
  if (s.status === 'signed-out')
    return (
      <a href={href({ name: 'settings' })} className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-[13px] text-accent hover:bg-raised/60">
        <CloudOff size={17} /> Sign in to save in the cloud
      </a>
    );

  const map = {
    syncing: { icon: <Loader2 size={17} className="animate-spin" />, text: 'Syncing…', cls: 'text-ink2' },
    idle: { icon: <Cloud size={17} />, text: `Synced ${timeAgo(s.lastSyncedAt)}`, cls: 'text-muted' },
    offline: { icon: <CloudOff size={17} />, text: 'Offline — saved on this device', cls: 'text-ok' },
    error: { icon: <TriangleAlert size={17} />, text: 'Sync failed — tap to retry', cls: 'text-[#f07a7a]' },
  } as const;
  const m = map[s.status];
  return (
    <button type="button" onClick={() => void syncNow()} title={s.error ?? `Signed in as ${s.user?.username}`} className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] transition hover:bg-raised/60 ${m.cls}`}>
      {m.icon}
      <span className="flex-1 truncate">{m.text}</span>
      {s.status === 'idle' && <RefreshCw size={13} className="opacity-60" />}
    </button>
  );
}
