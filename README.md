# DJ Set Planner

En lokal webapp for å planlegge og bygge DJ-sets: musikkbibliotek med BPM, key (Camelot), energi og tagger, og (i senere faser) en harmonisk mix-motor som foreslår rekkefølge, finner hull og anbefaler brolåter.

Alt lagres lokalt i nettleseren (IndexedDB). Ingen innlogging, ingen sky.

## Kjør på Render (ingen installasjon)

Appen er en statisk side, så den kan ligge gratis på [Render](https://render.com). Repoet har en `render.yaml` som setter opp alt.

1. Logg inn på Render og velg **New → Blueprint**.
2. Velg repoet `dj-set-planner` (gi Render tilgang til det hvis det ikke vises).
3. Trykk **Apply**. Etter et par minutter får du en adresse som `https://dj-set-planner.onrender.com`.

Hver gang det pushes til `main`, bygger Render en ny versjon automatisk.

> **Om data og personvern:** Render serverer bare selve appen. Låtene, setsene og notatene dine lagres i nettleseren på enheten din, ikke på Render. Andre som åpner adressen ser en tom app, ikke ditt bibliotek.

## Kjør lokalt

Du trenger [Node.js](https://nodejs.org) 20 eller nyere.

```bash
npm install
npm run dev
```

Åpne adressen Vite skriver ut (vanligvis http://localhost:5173).

### På mobilen

Enklest: åpne Render-adressen på mobilen. Lokalt starter `npm run dev` også serveren på det lokale nettverket; åpne **Network**-adressen Vite skriver ut (f.eks. `http://192.168.1.20:5173`) på mobilen, på samme Wi-Fi.

> **Merk:** Dataene ligger i nettleseren *på hver enhet*. Biblioteket på mobilen er et annet enn det på PC-en. Bruk **Data → Last ned backup** på den ene enheten og **Importer backup** på den andre for å flytte det.

### Andre kommandoer

| Kommando | Hva den gjør |
|---|---|
| `npm test` | Kjører enhetstestene (mix-motor, filtrering, database) |
| `npm run test:watch` | Tester i watch-modus |
| `npm run typecheck` | TypeScript-sjekk |
| `npm run build` | Produksjonsbygg til `dist/` |
| `npm run preview` | Server produksjonsbygget lokalt |

## Slik får du inn låter (uten lydfiler)

- **Lim inn en liste:** Importer → «Lim inn liste», én låt per linje: `Artist - Tittel (Remix)`.
- **Fra Spotify:** eksporter spillelisten som CSV på [exportify.net](https://exportify.net) og importer filen. Har filen tempo, key og energi, tas de med.
- **Enkeltvis:** «+ Ny låt», skriv artist og tittel og trykk «Hent data fra nett».

Importerte låter får status **⬇ Må skaffes** — det blir handlelisten din. Marker dem som **✓ Har filen** når du har lastet dem ned.

### Data fra nett

| Kilde | Gir | Krever |
|---|---|---|
| [GetSongBPM](https://getsongbpm.com/api) | BPM og key | Gratis API-nøkkel — legg den inn under ⚙ Innstillinger |
| Deezer | Lengde, år, label, iblant BPM | Ingenting |
| MusicBrainz | Lengde, første utgivelsesår | Ingenting |

- Sikre treff fyller inn tomme felter automatisk. Det du har skrevet inn selv, overskrives aldri.
- Usikre treff (annen remix, uenighet om BPM, half/double time) merkes **sjekk** og må bekreftes i låtskjemaet.
- Energi finnes ikke i noen gratis kilde, så den setter du selv (eller får fra Exportify hvis filen har den).
- Kallene går via `/api/...` på samme domene (proxy i `render.yaml` og `vite.config.ts`) for å unngå CORS-problemer.

## Bygge et set

1. **Sets → ＋ Nytt set.** Sett ønsket lengde (f.eks. 60 min) og velg energikurve — eller dra i punktene for å tegne din egen.
2. **＋ Legg til låter** i potten (søk, filtrer på BPM/sjanger/status, «Legg til alle viste»).
3. **⚡ Bygg rekkefølge.** Motoren gir tre forskjellige forslag; velg ett.
4. Juster for hånd: dra rader (desktop) eller bruk ↑/↓, 🔒 lås låter til plassen sin (første/siste/fast plass) og bygg på nytt. **Ctrl+Z** angrer.
5. Hver overgang får score, farge, ikon og forklaring (f.eks. «8A → 9A: +1 på hjulet · +2 BPM (1,6 %) · energi 6 → 7 — perfekt»). Røde/gule overganger har **🔎 Finn brolåt**.
6. **⇩ Eksport:** handleliste med lenker til Beatport/Bandcamp/Traxsource/YouTube/Spotify, liste for Spotify (via TuneMyMusic/Soundiiz), CSV og jukselapp for utskrift/PDF.

Mix-motoren ligger i `src/engine/` (ren TypeScript, enhetstestet):

| Fil | Gjør |
|---|---|
| `camelot.ts` | Key ⇄ Camelot, harmonisk kompatibilitet (samme, ±1, relativ, diagonal, +2/+7 energiløft) |
| `tempo.ts` | BPM-endring i prosent, half/double time (87 ↔ 174) |
| `transition.ts` | Samlet overgangsscore (key 50 %, tempo 35 %, energi 15 %) med forklaring |
| `energy.ts` | Energikurver (forhåndsvalg og egne punkter) |
| `sequencer.ts` | Rekkefølge: beam search + lokal forbedring, låste posisjoner, ønsket lengde, artistavstand, alternativer |
| `analysis.ts` | Starttider, hull, advarsler (samme artist, spilt nylig, manglende data), toppen av settet |
| `bridge.ts` | Ideell brolåt og rangering av kandidater |

## Hurtigtaster

| Tast | Handling |
|---|---|
| `/` | Søk i biblioteket |
| `N` | Ny låt |
| `I` | Importer liste/CSV |
| `F` | Vis/skjul filtre |
| `Esc` | Lukk dialog / fjern valg |
| `Ctrl+Enter` | Lagre låt |
| `A` / `B` / `E` | I et set: legg til låter / bygg rekkefølge / eksport |
| `Ctrl+Z` / `Ctrl+Shift+Z` | I et set: angre / gjør om |
| `?` | Vis hurtigtastene |

## Søketips

- Søket leter i artist, tittel, versjon, label, sjanger, stemning, tagger og notater, og ignorerer aksenter (`royksopp` finner Röyksopp).
- Skriver du en key (`8A`, `Am`, `A minor`, `F#m`, `1m`), filtreres det på den keyen.

## Mappestruktur

```
src/
  engine/          Mix-motoren: ren TypeScript uten React/DOM, fullt enhetstestet
  db/              Dexie/IndexedDB: skjema, låter, sets, backup
  importers/       Innlimt liste og CSV (Exportify, TuneMyMusic, regneark)
  sources/         Oppslag på nett: GetSongBPM, Deezer, MusicBrainz (utbyttbare adaptere)
  exporters/       Tekst, CSV og kjøpslenker for sets
  features/
    library/       Biblioteket: tabell, filtre, søk, sortering, redigering
    import/        Importdialogen
    sets/          Set-byggeren, grafer, Camelot-hjul, brolåter, eksport
    settings/      Innstillinger, API-nøkkel og backup
  components/      Felles UI-komponenter
  lib/             Hjelpere (normalisering, duplikatnøkler, hooks)
```

## Status

Planen er lagt om for å kunne planlegge et set uten lydfiler:

- [x] **Fase 1:** Prosjektoppsett, database, bibliotek med manuell registrering, søk, filtrering, sortering, duplikatmerking, JSON-backup
- [x] **Fase 2:** Import av innlimt liste og CSV (Exportify/TuneMyMusic/regneark), oppslag av BPM/key på nett (GetSongBPM, Deezer, MusicBrainz)
- [x] **Fase 3:** Mix-motoren, set-byggeren, visualisering og eksport (handleliste med kjøpslenker, tekst for Spotify, jukselapp)
- [x] **Fase 4:** Hull-markering og brolåt-forslag
- [ ] **Fase 5:** Sjangerprofiler og anbefalinger
- [ ] **Fase 6:** Lydfiler: import med tagger, BPM/key-analyse for å dobbeltsjekke verdiene, forhåndslytting, Rekordbox/Traktor
