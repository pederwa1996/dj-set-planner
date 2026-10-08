# DJ Set Planner

A personal web app for planning DJ sets — even before you own the audio files. Build a library (from a pasted list, a Spotify playlist via Exportify, or one track at a time), look up BPM and key online, browse by key/genre/tempo/energy, and let a harmonic mix engine suggest the order of your set. Then export a shopping list of what to download.

Everything is saved in your browser first (IndexedDB), so the app works offline. Sign in and it's also kept in the cloud (Supabase), so your library and sets are the same on your phone and computer.

## Run it on Render (no install)

The app is a static site, so it can be hosted for free on [Render](https://render.com). The repo includes a `render.yaml` that sets everything up.

1. In Render, choose **New → Blueprint**.
2. Pick the `dj-set-planner` repository (give Render access to it if it doesn't show up).
3. Click **Apply**. After a couple of minutes you get a URL like `https://dj-set-planner.onrender.com`.

Every push to `main` deploys a new version automatically.

> **Data and privacy:** Render only serves the app. Your tracks, sets and notes are stored in your browser and — when you're signed in — in your own Supabase account, protected by row-level security. Anyone else opening the URL sees an empty app and can't create an account.

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173). `npm run dev` also serves on your local network, so you can open the **Network** address on your phone (same Wi-Fi).

> Sign in (Settings → Account & sync) on each device to share the same library. Without signing in, data lives only in that browser.

| Command | What it does |
|---|---|
| `npm test` | Unit tests (mix engine, filters, importers, lookup, database, sync) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |

## Account & sync

- **Settings → Account & sync → Create account** — choose a username and password. The app allows exactly one account (yours); after that, sign-ups are refused.
- **Sign in on your other devices** with the same username and password. Tracks already on a device are merged into the account.
- Sync runs automatically: shortly after every change, when the app regains focus or comes back online, and every 30 seconds. The sidebar shows the status (synced / syncing / offline).
- Offline? Keep working — changes are saved locally and uploaded when you're back online. If the same track was changed on two devices, the newest change wins. Deletions sync too.
- No email is involved, so there's no password reset by email. If you forget the password, it can be reset from the Supabase project.

How it works: `src/sync/engine.ts` (pull changes since last time, then push local changes and deletions, last-write-wins), `src/sync/syncStore.ts` (when to sync, status), `supabase/` (table, security rules and the account function).

## Using it

**Home** shows your next set, quick actions and what needs attention (tracks to get, uncertain lookups, missing BPM/key/energy).

**Getting tracks in (no audio files needed)**
- **Paste a list:** Import → “Paste a list”, one track per line: `Artist - Title (Remix)`.
- **From Spotify:** export the playlist as CSV at [exportify.net](https://exportify.net) and import the file. Tempo, key and energy are included if the file has them.
- **One at a time:** “Add track”, type artist and title, press “Look up online”.

Imported tracks are marked **To get** — that becomes your shopping list. Mark them **Owned** once downloaded.

**Online lookup**

| Source | Gives | Needs |
|---|---|---|
| [GetSongBPM](https://getsongbpm.com/api) | BPM and key | Free API key — paste it in Settings |
| Deezer | Length, year, label, sometimes BPM | Nothing |
| MusicBrainz | Length, first release year | Nothing |

Confident matches fill in empty fields automatically; your own values are never overwritten. Uncertain matches (another remix, BPM disagreement, half/double time) are flagged **check**. Calls go through `/api/...` on the same domain (proxy in `render.yaml` and `vite.config.ts`) to avoid CORS issues.

**Browse** — explore by key (clickable Camelot wheel), genre, tempo range, energy, tags, mood and decade. Click any key badge anywhere in the app to see every track in that key and the keys that mix well with it (±1, relative, diagonal, energy boosts).

**Building a set**
1. **New set** — give it a name, a date and a **length** (30/45/60/90/120 min, your own, or no limit) and choose whole tracks or a fixed play time per track. The dialog shows roughly how many tracks that is. Then add tracks to its pool (from the library, or “Add to a set” from any Browse page).
   - **Find on the web** (in **Add tracks**) suggests tracks you don’t have yet. **Similar artists** looks up artists like the ones in your set on Deezer and takes their popular tracks; **Same genre** uses popular Deezer playlists for a genre (e.g. “trance”, “melodic techno”). Each track gets BPM and key from GetSongBPM and a **fit** score — the average of its three best transitions with tracks in the set — and is sorted best fit first. Listen to a 30-second preview, tick the ones you like (or **Select best 10**) and add them: they go into the pool and into your library as “to get”, tagged `web find`. Tracks you already have, in any version, are left out.
   - The engine fills the set to that length with the tracks that flow best and keeps the rest of the pool in reserve. Before you build, and in the suggestions, you can see how many tracks fit — pick a longer set or **Use all tracks** if you want every one in. Your last choice is remembered for the next set.
   - **From a Spotify playlist:** export it at [exportify.net](https://exportify.net) and drag the CSV onto the **Sets** page (or click **From Exportify CSV**) — it becomes a new set named after the playlist. Inside a set, drag a CSV onto the page (or **Import CSV**) to add it. Choose “Let the engine order them” (into the pool) or “Keep playlist order”, and the set length. Tracks already in your library are reused, and BPM/key/energy from the file are kept.
2. **Build order** — the engine returns three different options; pick one.
3. Fine-tune: drag rows (desktop) or use ↑/↓, lock tracks to their position, rebuild around them. **Ctrl+Z** undoes.
4. Every transition gets a score, an icon and an explanation, e.g. “8A → 9A: +1 on the wheel · +2 BPM (1.6%) · energy 6 → 7 — perfect”. Weak ones offer **Find bridge track**.
   - It first suggests tracks from your library (owned, then to-get).
   - **Search the web** looks outside your library: artists similar to the two tracks (Deezer), their popular tracks, BPM and key from GetSongBPM, ranked the same way. Play a 30-second preview, open it on Beatport/Spotify, then **Insert** it into the set or save it with **To get** (both add it to your library as “to get”, tagged `web find`). Keys need a GetSongBPM key in Settings.
5. **Export:** shopping list with Beatport/Bandcamp/Traxsource/YouTube/Spotify links, a list for Spotify (via TuneMyMusic/Soundiiz), CSV, and a printable cheat sheet.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `N` | New track |
| `I` | Import tracks |
| `/` | Search the library |
| `F` | Show / hide library filters |
| `A` / `B` / `E` | In a set: add tracks / build order / export |
| `Ctrl+Z` / `Ctrl+Shift+Z` | In a set: undo / redo |
| `?` | Show all shortcuts |

## Mix engine

`src/engine/` is plain TypeScript with no React/DOM and full unit tests:

| File | Does |
|---|---|
| `camelot.ts` | Key ⇄ Camelot conversion, harmonic compatibility (same, ±1, relative, diagonal, +2/+7 energy boost) |
| `tempo.ts` | BPM change in percent, half/double time (87 ↔ 174) |
| `transition.ts` | Combined transition score (key 50%, tempo 35%, energy 15%) with explanation |
| `energy.ts` | Energy curves (presets and custom points) |
| `sequencer.ts` | Ordering: beam search + local improvement, locked positions, target length, artist spacing, alternatives |
| `analysis.ts` | Start times, gaps, warnings (same artist, played recently, missing data), peak of the set |
| `bridge.ts` | Ideal bridge track and ranking of candidates |

## Project structure

```
supabase/          Database migration and Edge Function for the cloud account
src/
  engine/          Mix engine (pure TypeScript, unit-tested)
  db/              Dexie/IndexedDB: schema, tracks, sets, backup
  importers/       Pasted lists and CSV (Exportify, TuneMyMusic, spreadsheets)
  sources/         Online lookup adapters (GetSongBPM, Deezer, MusicBrainz) and web search for bridges and set suggestions
  exporters/       Text, CSV and shop links for sets
  components/      Shared UI (buttons, dialogs, badges, Camelot wheel, track rows)
  lib/             Router, settings, hooks, normalisation
  sync/            Cloud sync: Supabase client, sign-in, sync engine and status
  features/
    home/          Home screen
    library/       Library table, filters, track editor, online lookup panel
    browse/        Browse page and category pages (key, genre, BPM, energy …)
    import/        Import dialog
    sets/          Set list and set builder (chart, wheel, bridges, export)
    settings/      Settings page (API key, backup)
```

## Status

- [x] Library with manual entry, search, filters, sorting, duplicate detection, backup
- [x] Import from pasted lists and CSV; online BPM/key lookup
- [x] Mix engine, set builder, visualisation, gaps and bridge tracks, export
- [x] Home screen, Browse by category, English UI, new design (dark club palette, vinyl logo)
- [x] Account with username/password and cloud sync between devices (Supabase)
- [ ] Genre profiles and recommendations from external sources
- [ ] Audio files: import with tags, BPM/key analysis to double-check values, preview player, Rekordbox/Traktor export
