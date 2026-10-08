import { useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Compass } from 'lucide-react';
import { db } from '../../db/db';
import { CamelotWheel } from '../../components/CamelotWheel';
import { Chip, EmptyState, KeyBadge, PageHeader, energyStyle } from '../../components/ui';
import { camelotToMusical } from '../../engine/camelot';
import { href, navigate, type CategoryKind } from '../../lib/router';
import { openImport } from '../../lib/uiStore';
import { summarize } from './categories';

const cat = (kind: CategoryKind, value: string) => href({ name: 'category', kind, value });

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h2 className="serif text-xl">{title}</h2>
        {hint && <span className="text-[13px] text-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function BrowseView() {
  const tracks = useLiveQuery(() => db.tracks.toArray(), []);
  const s = useMemo(() => summarize(tracks ?? []), [tracks]);
  if (!tracks) return null;
  if (!tracks.length)
    return (
      <>
        <PageHeader title="Browse" />
        <EmptyState icon={<Compass size={28} />} title="Nothing to browse yet" actions={<button className="text-accent hover:underline" onClick={() => openImport()}>Import tracks</button>}>
          Import some tracks and you can explore them by key, genre, tempo and energy.
        </EmptyState>
      </>
    );

  const maxBpm = Math.max(1, ...s.bpm.map((x) => x[1]));
  const maxEnergy = Math.max(1, ...s.energy.map((x) => x[1]));
  const topKeys = [...s.keys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Browse" subtitle="Explore your library by key, genre, tempo and energy. Tap anything to see the tracks." />

      <Section title="Keys" hint="Tap a key to see its tracks and what mixes well with it">
        <div className="card grid grid-cols-1 items-center gap-6 p-5 md:grid-cols-[auto_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[340px]">
            <CamelotWheel counts={s.keys} size={340} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-muted">Most common keys</div>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {topKeys.map(([k, n]) => (
                <li key={k}>
                  <button type="button" onClick={() => navigate({ name: 'category', kind: 'key', value: k })} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left transition hover:bg-raised">
                    <KeyBadge camelot={k} showMusical={false} link={false} />
                    <span className="flex-1 text-sm text-ink2">{camelotToMusical(k)}</span>
                    <span className="text-sm tabular-nums text-muted">{n}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {s.genres.length > 0 && (
        <Section title="Genres">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {s.genres.map(([g, n]) => (
              <a key={g} href={cat('genre', g)} className="card flex min-h-20 flex-col justify-between p-4 transition hover:border-[#5a5953] hover:bg-raised/40">
                <span className="font-medium">{g}</span>
                <span className="text-[13px] text-muted">
                  {n} track{n === 1 ? '' : 's'}
                </span>
              </a>
            ))}
          </div>
        </Section>
      )}

      {s.bpm.length > 0 && (
        <Section title="Tempo" hint="5 BPM ranges">
          <div className="card flex flex-col gap-1 p-3">
            {s.bpm.map(([b, n]) => (
              <a key={b} href={cat('bpm', b)} className="flex min-h-10 items-center gap-3 rounded-lg px-2 transition hover:bg-raised">
                <span className="w-20 text-sm tabular-nums text-ink2">{b.replace('-', '–')}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-sidebar">
                  <span className="block h-2 rounded-full bg-tempo" style={{ width: `${(n / maxBpm) * 100}%` }} />
                </span>
                <span className="w-8 text-right text-sm tabular-nums text-muted">{n}</span>
              </a>
            ))}
          </div>
        </Section>
      )}

      {s.energy.length > 0 && (
        <Section title="Energy">
          <div className="card grid grid-cols-10 items-end gap-1.5 p-4">
            {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((e) => {
              const n = s.energy.find((x) => x[0] === e)?.[1] ?? 0;
              return (
                <a key={e} href={n ? cat('energy', e) : undefined} aria-disabled={!n} className={`flex flex-col items-center gap-1.5 ${n ? '' : 'pointer-events-none opacity-40'}`} title={`Energy ${e}: ${n} tracks`}>
                  <span className="text-xs tabular-nums text-muted">{n || ''}</span>
                  <span className="w-full max-w-6 rounded-t-md" style={{ height: `${8 + (n / maxEnergy) * 88}px`, background: energyStyle(Number(e)).background as string }} />
                  <span className="text-sm tabular-nums">{e}</span>
                </a>
              );
            })}
          </div>
        </Section>
      )}

      {(s.tags.length > 0 || s.moods.length > 0 || s.decades.length > 0) && (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {s.tags.length > 0 && (
            <Section title="Tags">
              <div className="flex flex-wrap gap-1.5">
                {s.tags.map(([t, n]) => (
                  <Chip key={t} count={n} onClick={() => navigate({ name: 'category', kind: 'tag', value: t })}>
                    {t}
                  </Chip>
                ))}
              </div>
            </Section>
          )}
          {s.moods.length > 0 && (
            <Section title="Moods">
              <div className="flex flex-wrap gap-1.5">
                {s.moods.map(([m, n]) => (
                  <Chip key={m} count={n} onClick={() => navigate({ name: 'category', kind: 'mood', value: m })}>
                    {m}
                  </Chip>
                ))}
              </div>
            </Section>
          )}
          {s.decades.length > 0 && (
            <Section title="Decades">
              <div className="flex flex-wrap gap-1.5">
                {s.decades.map(([d, n]) => (
                  <Chip key={d} count={n} onClick={() => navigate({ name: 'category', kind: 'decade', value: d })}>
                    {d}s
                  </Chip>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
