import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { createSet } from '../../db/sets';
import { Button, Field, Modal } from '../../components/ui';
import { navigate } from '../../lib/router';
import { SetLengthFields } from './SetLengthFields';
import { getLengthDefaults, saveLengthDefaults, type LengthChoice } from './setLength';

export const defaultSetName = () => `New set · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

/** Nytt set: navn, dato og hvor langt det skal være (avgjør hvor mange låter motoren tar med). */
export function NewSetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [length, setLength] = useState<LengthChoice>(getLengthDefaults);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDate('');
    setLength(getLengthDefaults());
    setBusy(false);
    setTimeout(() => nameRef.current?.focus(), 30);
  }, [open]);

  async function create() {
    setBusy(true);
    try {
      saveLengthDefaults(length);
      const s = await createSet(name.trim() || defaultSetName(), { ...length, date: date || null });
      onClose();
      navigate({ name: 'set', id: s.id });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New set"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-set-form" disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            Create set
          </Button>
        </>
      }
    >
      <form
        id="new-set-form"
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Name">
            <input ref={nameRef} className="input" placeholder={defaultSetName()} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Date (optional)">
            <span className="flex items-center gap-2 rounded-xl border border-line px-3 focus-within:border-[#5c5752]">
              <CalendarDays size={15} className="text-muted" />
              <input type="date" className="min-h-10 bg-transparent text-sm text-ink2 focus:outline-none" value={date} onChange={(e) => setDate(e.target.value)} />
            </span>
          </Field>
        </div>
        <SetLengthFields value={length} onChange={setLength} />
        <p className="text-xs text-muted">The engine fills the set to this length with the tracks that flow best, and keeps the rest of the pool in reserve. You can change it later in the set’s settings.</p>
      </form>
    </Modal>
  );
}
