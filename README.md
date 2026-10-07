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

## Hurtigtaster

| Tast | Handling |
|---|---|
| `/` | Søk i biblioteket |
| `N` | Ny låt |
| `F` | Vis/skjul filtre |
| `Esc` | Lukk dialog / fjern valg |
| `Ctrl+Enter` | Lagre låt |
| `?` | Vis hurtigtastene |

## Søketips

- Søket leter i artist, tittel, versjon, label, sjanger, stemning, tagger og notater, og ignorerer aksenter (`royksopp` finner Röyksopp).
- Skriver du en key (`8A`, `Am`, `A minor`, `F#m`, `1m`), filtreres det på den keyen.

## Mappestruktur

```
src/
  engine/          Mix-motoren: ren TypeScript uten React/DOM, fullt enhetstestet
    camelot.ts       key ↔ Camelot-konvertering, harmonisk kompatibilitet
  db/              Dexie/IndexedDB: skjema, låt-lagring, backup
  features/
    library/       Biblioteket: tabell, filtre, søk, sortering, redigering
  components/      Felles UI-komponenter
  lib/             Hjelpere (normalisering, duplikatnøkler, hooks)
```

## Status

- [x] **Fase 1:** Prosjektoppsett, database, bibliotek med manuell registrering, søk, filtrering, sortering, duplikatmerking, JSON-backup
- [ ] **Fase 2:** Import (lydfiler med tagger, M3U/CSV, Rekordbox/Traktor) og automatisk BPM/key-analyse
- [ ] **Fase 3:** Mix-motoren, set-byggeren og visualisering
- [ ] **Fase 4:** Hull-markering og brolåt-forslag
- [ ] **Fase 5:** Sjangerprofiler, anbefalinger og eksterne kilder
- [ ] **Fase 6:** Eksport, forhåndslytting og resten av ekstrafunksjonene
