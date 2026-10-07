import { ALL_CAMELOT } from '../../engine/camelot';
import { Button, Chip, keyColor, NumberInput } from '../../components/ui';
import { emptyFilter, type LibraryFilter } from './filter';

export function FilterPanel({ filter, onChange, genres, tags }: { filter: LibraryFilter; onChange: (f: LibraryFilter) => void; genres: string[]; tags: string[] }) {
  const set = <K extends keyof LibraryFilter>(k: K, v: LibraryFilter[K]) => onChange({ ...filter, [k]: v });
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="grid grid-cols-1 gap-5 rounded-xl border border-line bg-panel p-4 lg:grid-cols-2">
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted">BPM</h3>
        <div className="flex items-center gap-2">
          <NumberInput className="w-24" placeholder="fra" value={filter.bpmMin} onChange={(v) => set('bpmMin', v)} />
          <span className="text-muted">–</span>
          <NumberInput className="w-24" placeholder="til" value={filter.bpmMax} onChange={(v) => set('bpmMax', v)} />
          <label className="ml-2 flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-cyan-400" checked={filter.bpmHalfDouble} onChange={(e) => set('bpmHalfDouble', e.target.checked)} />
            ta med half/double time
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Energi</h3>
        <div className="flex items-center gap-2">
          <NumberInput className="w-20" placeholder="1" value={filter.energyMin} onChange={(v) => set('energyMin', v)} />
          <span className="text-muted">–</span>
          <NumberInput className="w-20" placeholder="10" value={filter.energyMax} onChange={(v) => set('energyMax', v)} />
          <span className="ml-2 text-sm text-muted">Min. vurdering</span>
          <select className="input w-24" value={filter.minRating} onChange={(e) => set('minRating', Number(e.target.value))}>
            <option value={0}>alle</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {'★'.repeat(n)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="flex flex-col gap-2 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Key</h3>
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-cyan-400" checked={filter.keyCompatible} onChange={(e) => set('keyCompatible', e.target.checked)} />
            ta med harmonisk kompatible (±1, relativ)
          </label>
        </div>
        <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
          {ALL_CAMELOT.filter((c) => c.endsWith('A'))
            .concat(ALL_CAMELOT.filter((c) => c.endsWith('B')))
            .map((c) => {
              const on = filter.keys.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('keys', toggle(filter.keys, c))}
                  className={`h-10 rounded-md text-sm font-bold transition ${on ? 'text-white ring-2 ring-white' : 'text-white/70 opacity-50 hover:opacity-90'}`}
                  style={{ background: keyColor(c) }}
                >
                  {c}
                </button>
              );
            })}
        </div>
      </section>

      {genres.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Sjanger</h3>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <Chip key={g} active={filter.genres.includes(g)} onClick={() => set('genres', toggle(filter.genres, g))}>
                {g}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {tags.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Tagger (alle må matche)</h3>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((g) => (
              <Chip key={g} active={filter.tags.includes(g)} onClick={() => set('tags', toggle(filter.tags, g))}>
                {g}
              </Chip>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-wrap items-center gap-2 lg:col-span-2">
        {(['all', 'owned', 'wishlist'] as const).map((s) => (
          <Chip key={s} active={filter.status === s} onClick={() => set('status', s)}>
            {s === 'all' ? 'Alle' : s === 'owned' ? '✓ Har filen' : '⬇ Må skaffes'}
          </Chip>
        ))}
        <Chip active={filter.onlyDuplicates} onClick={() => set('onlyDuplicates', !filter.onlyDuplicates)}>
          Bare duplikater
        </Chip>
        <Chip active={filter.needs === 'missing'} onClick={() => set('needs', filter.needs === 'missing' ? 'all' : 'missing')}>
          Mangler BPM/key
        </Chip>
        <Chip active={filter.needs === 'check'} onClick={() => set('needs', filter.needs === 'check' ? 'all' : 'check')}>
          Må sjekkes
        </Chip>
        <Button variant="ghost" className="ml-auto" onClick={() => onChange({ ...emptyFilter, query: filter.query })}>
          Nullstill filtre
        </Button>
      </section>
    </div>
  );
}
