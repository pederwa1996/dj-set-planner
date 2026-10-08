import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Check, Download, Star, X } from 'lucide-react';
import { ALL_CAMELOT, camelotToMusical, toCamelot } from '../engine/camelot';
import { href, keyRoute, type Route } from '../lib/router';

/* ---------- Knapper ---------- */

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-cream text-[#0e0d0c] hover:bg-white font-medium',
  accent: 'bg-accent text-[#0e0d0c] hover:bg-[#ff7f4f] font-medium',
  secondary: 'border border-line text-ink hover:bg-raised',
  ghost: 'text-ink2 hover:bg-raised hover:text-ink',
  danger: 'bg-bad text-white hover:bg-[#de4b4b] font-medium',
};

export function Button({ variant = 'secondary', size = 'md', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'min-h-9 px-3 text-[13px] rounded-lg' : 'min-h-11 px-4 text-sm rounded-xl';
  return <button type="button" className={`inline-flex items-center justify-center gap-2 whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-40 ${sz} ${variants[variant]} ${className}`} {...rest} />;
}

export function IconButton({ label, className = '', active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg transition disabled:opacity-30 ${active ? 'text-accent' : 'text-muted hover:bg-raised hover:text-ink'} ${className}`}
      {...rest}
    />
  );
}

/** Lenke til en rute (hash-ruting) */
export function Link({ to, className = '', children, title, onClick }: { to: Route; className?: string; children: ReactNode; title?: string; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <a href={href(to)} className={className} title={title} onClick={onClick}>
      {children}
    </a>
  );
}

/* ---------- Dialog ---------- */

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
    <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[92dvh] w-full animate-pop-in flex-col rounded-t-3xl border border-line bg-surface shadow-2xl shadow-black/40 sm:rounded-2xl ${wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <h2 className="serif text-xl">{title}</h2>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X size={18} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-2">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Skjemaelementer ---------- */

/**
 * Felt med etikett. Bruk `group` når innholdet er flere knapper/kontroller
 * (da blir det en navngitt gruppe i stedet for en <label> rundt alt).
 */
export function Field({ label, children, hint, className = '', group }: { label: string; children: ReactNode; hint?: ReactNode; className?: string; group?: boolean }) {
  const inner = (
    <>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </>
  );
  return group ? (
    <div role="group" aria-label={label} className={`flex flex-col gap-1.5 ${className}`}>
      {inner}
    </div>
  ) : (
    <label className={`flex flex-col gap-1.5 ${className}`}>{inner}</label>
  );
}

/** Segmentert velger (som i Claude-appens innstillinger) */
export function Segmented<T extends string>({ value, onChange, options, className = '' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="radiogroup" className={`inline-flex rounded-xl border border-line bg-sidebar p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] transition ${value === o.value ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stars({ value, onChange, size = 'md' }: { value: number; onChange?: (v: number) => void; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 13 : 22;
  return (
    <span className="inline-flex items-center" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Star size={px} className={n <= value ? 'fill-accent text-accent' : 'text-[#46423e]'} />;
        return onChange ? (
          <button key={n} type="button" className="grid h-11 w-9 place-items-center" onClick={() => onChange(n === value ? 0 : n)} aria-label={`${n} stars`}>
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        );
      })}
    </span>
  );
}

/* ---------- Energi og key ---------- */

/** Energi 1–10 som én fargetone fra dempet til sterk (sekvensiell skala, tallet vises alltid) */
export function energyStyle(e: number | null): React.CSSProperties {
  if (e == null) return { background: '#272523', color: '#8f897e' };
  const t = (Math.min(10, Math.max(1, e)) - 1) / 9;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return { background: `rgb(${mix(62, 217)}, ${mix(58, 89)}, ${mix(54, 38)})`, color: '#fff' };
}

export function EnergyBadge({ value }: { value: number | null }) {
  return (
    <span className="inline-grid h-6 min-w-6 place-items-center rounded-md px-1 text-xs font-semibold tabular-nums" style={energyStyle(value)} title={value == null ? 'Energy not set' : `Energy ${value}/10`}>
      {value ?? '–'}
    </span>
  );
}

export function EnergyPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? null : n)}
          aria-pressed={n === value}
          className={`h-11 rounded-lg text-sm font-semibold tabular-nums transition ${n === value ? 'ring-2 ring-cream ring-offset-2 ring-offset-surface' : 'opacity-80 hover:opacity-100'}`}
          style={energyStyle(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/** Fast farge per posisjon på Camelot-hjulet (med tekst, så fargen er aldri alene) */
export function keyColor(camelot: string | null): string {
  if (!camelot) return '#3b3835';
  const num = parseInt(camelot, 10);
  const minor = camelot.endsWith('A');
  return `hsl(${((num - 1) * 30 + 10) % 360} ${minor ? 38 : 46}% ${minor ? 36 : 44}%)`;
}

/** Key som merke; klikkbar til key-siden når `link` er satt */
export function KeyBadge({ camelot, showMusical = true, link = true }: { camelot: string | null; showMusical?: boolean; link?: boolean }) {
  if (!camelot) return <span className="text-muted">–</span>;
  const inner = (
    <>
      <span className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-white" style={{ background: keyColor(camelot) }}>
        {camelot}
      </span>
      {showMusical && <span className="text-xs text-muted">{camelotToMusical(camelot, 'short')}</span>}
    </>
  );
  return link ? (
    <a href={href(keyRoute(camelot))} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md hover:brightness-125" title={`All tracks in ${camelot} (${camelotToMusical(camelot)})`}>
      {inner}
    </a>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">{inner}</span>
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
      <select className="input sm:w-52" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label="Key">
        <option value="">Unknown key</option>
        {ALL_CAMELOT.map((c) => (
          <option key={c} value={c}>
            {c} · {camelotToMusical(c)}
          </option>
        ))}
      </select>
      <input
        className={`input flex-1 ${text && !parsed ? 'border-bad' : ''}`}
        placeholder="…or type: A minor, Am, 8A"
        aria-label="Type a key"
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

/* ---------- Status ---------- */

export function StatusPill({ status }: { status: 'owned' | 'wishlist' }) {
  return status === 'owned' ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted">
      <Check size={13} /> Owned
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-accent">
      <Download size={13} /> To get
    </span>
  );
}

/* ---------- Chips og tagger ---------- */

export function Chip({ children, onRemove, active, onClick, count }: { children: ReactNode; onRemove?: () => void; active?: boolean; onClick?: () => void; count?: number }) {
  const base = `inline-flex items-center gap-1.5 rounded-full border px-3 text-[13px] transition ${active ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line text-ink2'}`;
  const c = count != null && <span className="text-xs tabular-nums text-muted">{count}</span>;
  if (onClick)
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={`${base} min-h-9 hover:border-[#5c5752] hover:text-ink`}>
        {children}
        {c}
      </button>
    );
  return (
    <span className={`${base} min-h-8`}>
      {children}
      {c}
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-1.5 grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-raised hover:text-ink" aria-label="Remove">
          <X size={13} />
        </button>
      )}
    </span>
  );
}

export const DEFAULT_TAGS = ['vocal', 'instrumental', 'peak time', 'warm-up', 'closer', 'opener', 'classic', 'banger', 'acapella', 'tool'];

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
          placeholder="New tag + Enter"
          aria-label="New tag"
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
export function SuggestInput({ value, onChange, suggestions, placeholder, label }: { value: string; onChange: (v: string) => void; suggestions: string[]; placeholder?: string; label?: string }) {
  const listId = useId();
  return (
    <>
      <input className="input" list={listId} value={value} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}

/** Tallfelt som godtar komma, og bare sender gyldige tall (eller null) videre. */
export function NumberInput({ value, onChange, placeholder, step, className = '', label }: { value: number | null; onChange: (v: number | null) => void; placeholder?: string; step?: string; className?: string; label?: string }) {
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
      aria-label={label}
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

/* ---------- Layout ---------- */

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3 pb-2">
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="mb-1 text-[13px] text-muted">{eyebrow}</div>}
        <h1 className="serif text-[28px] leading-tight sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children, actions }: { icon?: ReactNode; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="serif text-xl">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      {actions && <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export const fmtDate = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => (iso ? new Date(iso).toLocaleDateString('en-GB', opts) : '');
