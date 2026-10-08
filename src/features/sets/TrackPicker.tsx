import { useMemo, useState } from "react";
import { Globe, Library, Loader2, Search } from "lucide-react";
import type { Track } from "../../db/types";
import {
  Button,
  Chip,
  EnergyBadge,
  KeyBadge,
  Modal,
  NumberInput,
  Segmented,
} from "../../components/ui";
import {
  emptyFilter,
  filterTracks,
  sortTracks,
  type LibraryFilter,
} from "../library/filter";
import { useWebFinder, WebFinderPanel } from "./WebFinder";

type Tab = "library" | "web";

/** Velg låter til potten for settet: fra biblioteket, eller forslag fra nettet. */
export function TrackPicker({
  open,
  onClose,
  tracks,
  already,
  onAdd,
  genres,
  setTracks,
  setName,
  maxTempoPct,
}: {
  open: boolean;
  onClose: () => void;
  tracks: Track[];
  already: Set<string>;
  onAdd: (ids: string[]) => void;
  genres: string[];
  /** Låtene i settet og potten (brukes til å rangere forslag fra nettet) */
  setTracks: Track[];
  setName: string;
  maxTempoPct: number;
}) {
  const [tab, setTab] = useState<Tab>("library");
  const web = useWebFinder({
    open,
    setTracks,
    library: tracks,
    maxTempoPct,
    setName,
  });
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<LibraryFilter>(emptyFilter);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const shown = useMemo(
    () => sortTracks(filterTracks(tracks, f), { column: "bpm", dir: "asc" }),
    [tracks, f],
  );
  const addable = shown.filter((t) => !already.has(t.id));
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const finish = (ids: string[]) => {
    onAdd(ids);
    setPicked(new Set());
    onClose();
  };

  const addFromWeb = async () => {
    setSaving(true);
    try {
      const ids = await web.addPicked();
      if (ids.length) onAdd(ids);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Add tracks to the pool"
      footer={
        tab === "library" ? (
          <>
            <Button
              className="mr-auto"
              onClick={() => finish(addable.map((t) => t.id))}
              disabled={!addable.length}
            >
              Add all {addable.length} shown
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!picked.size}
              onClick={() => finish([...picked])}
            >
              Add {picked.size || ""}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!web.picked.size || saving}
              onClick={() => void addFromWeb()}
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Add {web.picked.size || ""} to the pool
            </Button>
          </>
        )
      }
    >
      <div className="mb-4">
        <Segmented
          className="w-full"
          value={tab}
          onChange={setTab}
          options={[
            {
              value: "library",
              label: (
                <>
                  <Library size={15} /> Your library
                </>
              ),
            },
            {
              value: "web",
              label: (
                <>
                  <Globe size={15} /> Find on the web
                  {web.run.status === "running" && (
                    <Loader2 size={13} className="animate-spin" />
                  )}
                </>
              ),
            },
          ]}
        />
      </div>
      {tab === "web" ? (
        <WebFinderPanel w={web} hasSet={setTracks.length > 0} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              className="input w-full pl-10"
              autoFocus
              type="search"
              placeholder="Search artist, title, tag, key…"
              value={f.query}
              onChange={(e) => setF({ ...f, query: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[13px] text-muted">BPM</span>
            <NumberInput
              className="w-20"
              placeholder="from"
              label="BPM from"
              value={f.bpmMin}
              onChange={(v) => setF({ ...f, bpmMin: v })}
            />
            <NumberInput
              className="w-20"
              placeholder="to"
              label="BPM to"
              value={f.bpmMax}
              onChange={(v) => setF({ ...f, bpmMax: v })}
            />
            <Segmented
              value={f.status}
              onChange={(status) => setF({ ...f, status })}
              options={[
                { value: "all", label: "All" },
                { value: "owned", label: "Owned" },
                { value: "wishlist", label: "To get" },
              ]}
            />
          </div>
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <Chip
                  key={g}
                  active={f.genres.includes(g)}
                  onClick={() =>
                    setF({
                      ...f,
                      genres: f.genres.includes(g)
                        ? f.genres.filter((x) => x !== g)
                        : [...f.genres, g],
                    })
                  }
                >
                  {g}
                </Chip>
              ))}
            </div>
          )}
          <ul className="flex max-h-[48dvh] flex-col overflow-y-auto">
            {shown.slice(0, 400).map((t) => {
              const inPool = already.has(t.id);
              return (
                <li key={t.id}>
                  <label
                    className={`flex min-h-12 items-center gap-3 rounded-xl px-2 ${inPool ? "opacity-40" : "hover:bg-raised"}`}
                  >
                    <input
                      type="checkbox"
                      className="h-[18px] w-[18px] accent-[#ef6a3a]"
                      disabled={inPool}
                      checked={inPool || picked.has(t.id)}
                      onChange={() => toggle(t.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {t.artist} – {t.title}
                        {t.version && (
                          <span className="text-muted"> · {t.version}</span>
                        )}
                      </span>
                      <span className="text-xs text-muted">
                        {t.genre}
                        {t.status === "wishlist" && " · to get"}
                        {inPool && " · already in pool"}
                      </span>
                    </span>
                    <span className="w-10 text-right text-sm tabular-nums text-ink2">
                      {t.bpm ? Math.round(t.bpm) : "–"}
                    </span>
                    <KeyBadge
                      camelot={t.camelot}
                      showMusical={false}
                      link={false}
                    />
                    <EnergyBadge value={t.energy} />
                  </label>
                </li>
              );
            })}
            {!shown.length && (
              <li className="p-4 text-center text-sm text-muted">
                No tracks match.
              </li>
            )}
          </ul>
        </div>
      )}
    </Modal>
  );
}
