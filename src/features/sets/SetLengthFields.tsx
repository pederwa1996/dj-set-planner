import { Clock } from 'lucide-react';
import { Field, NumberInput, Segmented } from '../../components/ui';
import { LENGTH_PRESETS, describeLength, estimateLength, type LengthChoice } from './setLength';

export const choiceClass = (on: boolean) =>
  `min-h-10 rounded-xl border px-3 text-[13px] transition ${on ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line text-ink2 hover:border-[#5c5752] hover:text-ink'}`;

/**
 * Lengde på settet + spilletid per låt, med et anslag over hvor mange låter
 * som får plass. `durations` er låtene i potten (eller spillelisten) hvis vi har dem.
 */
export function SetLengthFields({ value, onChange, durations = [], keepAll }: { value: LengthChoice; onChange: (v: LengthChoice) => void; durations?: (number | null)[]; keepAll?: boolean }) {
  const set = (p: Partial<LengthChoice>) => onChange({ ...value, ...p });
  const custom = value.targetMinutes != null && !LENGTH_PRESETS.includes(value.targetMinutes);
  const estimate = estimateLength(durations, value);

  return (
    <div className="flex flex-col gap-5">
      <Field label="Set length" group>
        <div className="flex flex-wrap items-center gap-2">
          {LENGTH_PRESETS.map((m) => (
            <button key={m} type="button" aria-pressed={value.targetMinutes === m} onClick={() => set({ targetMinutes: m })} className={choiceClass(value.targetMinutes === m)}>
              {m} min
            </button>
          ))}
          <span className={`flex items-center gap-1.5 rounded-xl ${custom ? 'text-accent' : ''}`}>
            <NumberInput className={`w-20 ${custom ? '!border-accent/50' : ''}`} placeholder="other" label="Set length in minutes" value={custom ? value.targetMinutes : null} onChange={(v) => v && v > 0 && set({ targetMinutes: Math.round(v) })} />
            <span className="text-[13px] text-muted">min</span>
          </span>
          <button type="button" aria-pressed={value.targetMinutes == null} onClick={() => set({ targetMinutes: null })} className={choiceClass(value.targetMinutes == null)}>
            No limit
          </button>
        </div>
      </Field>

      <Field label="Play time per track" group hint={value.playMode === 'full' ? 'Track length minus ~45 seconds of mixing. Tracks without a length count as 5:30.' : 'For when you only play part of each track.'}>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={value.playMode}
            onChange={(playMode) => set({ playMode })}
            options={[
              { value: 'full', label: 'Whole track' },
              { value: 'fixed', label: 'Fixed time' },
            ]}
          />
          {value.playMode === 'fixed' && (
            <>
              <NumberInput className="w-20" label="Minutes per track" value={value.fixedMinutes} onChange={(v) => v && v > 0 && set({ fixedMinutes: v })} />
              <span className="text-sm text-muted">min</span>
            </>
          )}
        </div>
      </Field>

      <p className="flex gap-2 rounded-xl bg-sidebar/70 px-3 py-2.5 text-[13px] text-ink2" aria-live="polite">
        <Clock size={15} className="mt-px shrink-0 text-muted" />
        <span>{describeLength(estimate, value, { keepAll })}</span>
      </p>
    </div>
  );
}
