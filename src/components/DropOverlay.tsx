import { FileSpreadsheet } from 'lucide-react';

/** Vises mens en fil dras over vinduet */
export function DropOverlay({ show, title, text }: { show: boolean; title: string; text: string }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-black/60 p-6 backdrop-blur-[2px]">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-accent bg-surface/95 px-10 py-12 text-center shadow-2xl">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <FileSpreadsheet size={28} />
        </span>
        <p className="serif text-2xl">{title}</p>
        <p className="text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}
