import { ALL_CAMELOT } from '../../engine/camelot';
import { Button, Chip, keyColor, NumberInput } from '../../components/ui';
import { emptyFilter, type LibraryFilter } from './filter';

export function FilterPanel({ filter, onChange, genres, tags }: { filter: LibraryFilter; onChange: (f: LibraryFilter) => void; genres: string[]; tags: string[] }) {
  const set = <K extends keyof LibraryFilter>(k: K, v: LibraryFilter[K]) => onChange({ ...filter, [k]: v });
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const heading = 'text-[13px] font-medium text-ink2';

  return (
    <div className="card grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
      <section className="flex flex-col gap-2">
        <h3 className={heading}>BPM</h3>
        <div className="flex flex-wrap items-center gap-2">
          <NumberInput className="w-24" placeholder="from" label="BPM from" value={filter.bpmMin} onChange={(v) => set('bpmMin', v)} />
          <span className="text-muted">–</span>
          <NumberInput className="w-24" placeholder="to" label="BPM to" value={filter.bpmMax} onChange={(v) => set('bpmMax', v)} />
          <label className="ml-1 flex min-h-11 items-center gap-2 text-sm text-ink2">
            <input type="checkbox" className="h-5 w-5 accent-[#ef6a3a]" checked={filter.bpmHalfDouble} onChange={(e) => set('bpmHalfDouble', e.target.checked)} />
            include half/double time
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={heading}>Energy and rating</h3>
        <div className="flex flex-wrap items-center gap-2">
          <NumberInput className="w-20" placeholder="1" label="Energy from" value={filter.energyMin} onChange={(v) => set('energyMin', v)} />
          <span className="text-muted">–</span>
          <NumberInput className="w-20" placeholder="10" label="Energy to" value={filter.energyMax} onChange={(v) => set('energyMax', v)} />
          <select className="input ml-1 w-32" value={filter.minRating} onChange={(e) => set('minRating', Number(e.target.value))} aria-label="Minimum rating">
            <option value={0}>Any rating</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {'★'.repeat(n)}+
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="flex flex-col gap-2 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className={heading}>Key</h3>
          <label className="flex min-h-9 items-center gap-2 text-sm text-ink2">
            <input type="checkbox" className="h-5 w-5 accent-[#ef6a3a]" checked={filter.keyCompatible} onChange={(e) => set('keyCompatible', e.target.checked)} />
            also include compatible keys (±1, relative)
          </label>
        </div>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {ALL_CAMELOT.filter((c) => c.endsWith('A'))
            .concat(ALL_CAMELOT.filter((c) => c.endsWith('B')))
            .map((c) => {
              const on = filter.keys.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('keys', toggle(filter.keys, c))}
                  className={`h-10 rounded-lg text-[13px] font-semibold text-white transition ${on ? 'ring-2 ring-cream ring-offset-2 ring-offset-surface' : 'opacity-45 hover:opacity-90'}`}
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
          <h3 className={heading}>Genre</h3>
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
          <h3 className={heading}>Tags (must have all)</h3>
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
        <Chip active={filter.onlyDuplicates} onClick={() => set('onlyDuplicates', !filter.onlyDuplicates)}>
          Duplicates only
        </Chip>
        <Chip active={filter.needs === 'missing'} onClick={() => set('needs', filter.needs === 'missing' ? 'all' : 'missing')}>
          Missing BPM/key
        </Chip>
        <Chip active={filter.needs === 'check'} onClick={() => set('needs', filter.needs === 'check' ? 'all' : 'check')}>
          Needs checking
        </Chip>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onChange({ ...emptyFilter, query: filter.query, status: filter.status })}>
          Reset filters
        </Button>
      </section>
    </div>
  );
}

/** Aktive filtre som små brikker du kan fjerne én og én */
export function activeFilterChips(f: LibraryFilter, onChange: (f: LibraryFilter) => void): { key: string; label: string; remove: () => void }[] {
  const out: { key: string; label: string; remove: () => void }[] = [];
  if (f.bpmMin != null || f.bpmMax != null)
    out.push({ key: 'bpm', label: `${f.bpmMin ?? '…'}–${f.bpmMax ?? '…'} BPM${f.bpmHalfDouble ? ' (½/2×)' : ''}`, remove: () => onChange({ ...f, bpmMin: null, bpmMax: null, bpmHalfDouble: false }) });
  f.keys.forEach((k) => out.push({ key: `k${k}`, label: `Key ${k}${f.keyCompatible ? ' + compatible' : ''}`, remove: () => onChange({ ...f, keys: f.keys.filter((x) => x !== k) }) }));
  if (f.energyMin != null || f.energyMax != null) out.push({ key: 'e', label: `Energy ${f.energyMin ?? 1}–${f.energyMax ?? 10}`, remove: () => onChange({ ...f, energyMin: null, energyMax: null }) });
  f.genres.forEach((g) => out.push({ key: `g${g}`, label: g, remove: () => onChange({ ...f, genres: f.genres.filter((x) => x !== g) }) }));
  f.tags.forEach((t) => out.push({ key: `t${t}`, label: `#${t}`, remove: () => onChange({ ...f, tags: f.tags.filter((x) => x !== t) }) }));
  if (f.minRating > 0) out.push({ key: 'r', label: `${'★'.repeat(f.minRating)}+`, remove: () => onChange({ ...f, minRating: 0 }) });
  if (f.onlyDuplicates) out.push({ key: 'd', label: 'Duplicates', remove: () => onChange({ ...f, onlyDuplicates: false }) });
  if (f.needs !== 'all') out.push({ key: 'n', label: f.needs === 'missing' ? 'Missing BPM/key' : 'Needs checking', remove: () => onChange({ ...f, needs: 'all' }) });
  return out;
}
