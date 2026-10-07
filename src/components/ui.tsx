import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ALL_CAMELOT, camelotToMusical, toCamelot } from '../engine/camelot';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-slate-950 hover:bg-cyan-300 font-semibold',
  secondary: 'bg-panel2 text-slate-100 hover:bg-line border border-line',
  ghost: 'text-slate-200 hover:bg-panel2',
  danger: 'bg-red-600/90 text-white hover:bg-red-500 font-semibold',
};

export function Button({ variant = 'secondary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[95dvh] w-full flex-col rounded-t-2xl border border-line bg-panel shadow-2xl sm:rounded-2xl ${wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg text-2xl text-muted hover:bg-panel2" aria-label="Lukk">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Felt med etikett. Bruk `group` når innholdet er flere knapper/kontroller
 * (da blir det en navngitt gruppe i stedet for en <label> rundt alt).
 */
export function Field({ label, children, hint, className = '', group }: { label: string; children: ReactNode; hint?: ReactNode; className?: string; group?: boolean }) {
  const inner = (
    <>
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </>
  );
  return group ? (
    <div role="group" aria-label={label} className={`flex flex-col gap-1 ${className}`}>
      {inner}
    </div>
  ) : (
    <label className={`flex flex-col gap-1 ${className}`}>{inner}</label>
  );
}

export function Stars({ value, onChange, size = 'md' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'text-base' : 'text-2xl min-w-9 min-h-11';
  return (
    <span className="inline-flex items-center" aria-label={`${value} av 5 stjerner`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" className={`${cls} px-0.5 ${n <= value ? 'text-amber-400' : 'text-slate-600'} hover:text-amber-300`} onClick={() => onChange(n === value ? 0 : n)} aria-label={`${n} stjerner`}>
            ★
          </button>
        ) : (
          <span key={n} className={`${cls} ${n <= value ? 'text-amber-400' : 'text-slate-700'}`}>
            ★
          </span>
        ),
      )}
    </span>
  );
}

/** Farge for energi 1–10, fra blå (rolig) til rød (peak) */
export function energyColor(e: number | null): string {
  if (e == null) return 'bg-slate-700 text-slate-300';
  if (e <= 3) return 'bg-sky-700 text-white';
  if (e <= 5) return 'bg-emerald-700 text-white';
  if (e <= 7) return 'bg-amber-600 text-slate-950';
  if (e <= 8) return 'bg-orange-600 text-white';
  return 'bg-red-600 text-white';
}

export function EnergyBadge({ value }: { value: number | null }) {
  return <span className={`inline-grid h-7 min-w-7 place-items-center rounded-md px-1 text-sm font-bold ${energyColor(value)}`}>{value ?? '–'}</span>;
}

export function EnergyPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? null : n)}
          className={`h-11 rounded-md text-sm font-bold transition ${n === value ? `${energyColor(n)} ring-2 ring-white` : 'bg-panel2 text-slate-300 hover:bg-line'}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/** Hue på Camelot-hjulet, brukes til å fargelegge keys konsistent */
export function keyColor(camelot: string | null): string {
  if (!camelot) return 'hsl(220 10% 40%)';
  const num = parseInt(camelot, 10);
  const minor = camelot.endsWith('A');
  return `hsl(${((num - 1) * 30 + 0) % 360} ${minor ? 55 : 70}% ${minor ? 38 : 48}%)`;
}

export function KeyBadge({ camelot, showMusical = true }: { camelot: string | null; showMusical?: boolean }) {
  if (!camelot) return <span className="text-muted">–</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="rounded-md px-1.5 py-0.5 text-sm font-bold text-white" style={{ background: keyColor(camelot) }}>
        {camelot}
      </span>
      {showMusical && <span className="text-xs text-muted">{camelotToMusical(camelot, 'short')}</span>}
    </span>
  );
}

/**
 * Key-velger: nedtrekksliste med begge notasjoner, pluss et fritekstfelt
 * som godtar "A minor", "Am", "8A", "1m" osv. og konverterer automatisk.
 */
export function KeyInput({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [text, setText] = useState('');
  const parsed = text ? toCamelot(text) : null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <select className="input sm:w-52" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Ukjent key</option>
        {ALL_CAMELOT.map((c) => (
          <option key={c} value={c}>
            {c} · {camelotToMusical(c)}
          </option>
        ))}
      </select>
      <input
        className={`input flex-1 ${text && !parsed ? 'border-bad' : ''}`}
        placeholder="…eller skriv: A minor, Am, 8A"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const c = toCamelot(e.target.value);
          if (c) onChange(c);
        }}
        onBlur={() => parsed && setText('')}
      />
    </div>
  );
}

export function Chip({ children, onRemove, active, onClick }: { children: ReactNode; onRemove?: () => void; active?: boolean; onClick?: () => void }) {
  const base = `inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${active ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-panel2 text-slate-200'}`;
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={`${base} min-h-9 hover:border-accent`}>
        {children}
      </button>
    );
  return (
    <span className={base}>
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-1 grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-line hover:text-white" aria-label="Fjern">
          ×
        </button>
      )}
    </span>
  );
}

export const DEFAULT_TAGS = ['vokal', 'instrumental', 'peak time', 'warm-up', 'closer', 'opener', 'klassiker', 'banger', 'acapella', 'tool'];

export function TagInput({ value, onChange, suggestions }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
  const [text, setText] = useState('');
  const listId = useId();
  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setText('');
  };
  const quick = Array.from(new Set([...DEFAULT_TAGS, ...suggestions])).filter((s) => !value.includes(s)).slice(0, 14);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <Chip key={tag} onRemove={() => onChange(value.filter((x) => x !== tag))}>
            {tag}
          </Chip>
        ))}
        <input
          className="input min-w-40 flex-1"
          list={listId}
          placeholder="Ny tagg + Enter"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => text && add(text)}
        />
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quick.map((s) => (
            <Chip key={s} onClick={() => add(s)}>
              + {s}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tekstfelt med forslag fra eksisterende verdier */
export function SuggestInput({ value, onChange, suggestions, placeholder }: { value: string; onChange: (v: string) => void; suggestions: string[]; placeholder?: string }) {
  const listId = useId();
  return (
    <>
      <input className="input" list={listId} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}

/** Tallfelt som godtar komma, og bare sender gyldige tall (eller null) videre. */
export function NumberInput({ value, onChange, placeholder, step, className = '' }: { value: number | null; onChange: (v: number | null) => void; placeholder?: string; step?: string; className?: string }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(value == null ? '' : String(value));
      last.current = value;
    }
  }, [value]);
  return (
    <input
      className={`input ${className}`}
      inputMode="decimal"
      step={step}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const t = e.target.value.trim().replace(',', '.');
        const n = t === '' ? null : Number(t);
        if (n === null || isFinite(n)) {
          last.current = n;
          onChange(n);
        }
      }}
    />
  );
}
