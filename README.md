# FloodPath-Care

Flood-aware emergency routing to maternal-care facilities: a historical-data-informed **simulation** that compares conventional shortest-path routing with flood-aware routing, using the Chennai 2015 floods as a replay. Built for the Seva First Innovation Challenge (Track A).

**Status: all planned views built: KPI cards and charts, Route explorer with explanation text, audit log, Isolation priority view by ward (Census 2011 populations, 155-ward join), Metrics table and Export page (CSV and JSON). Tamil and Hindi are draft translations; a review checklist is in docs/TRANSLATION_REVIEW.md. Facility verification and a demo recording are not done. All results are simulation outputs, not predictions.**

## What it is not
Not live data, not a flood predictor, not a dispatch system. Ambulance data is simulated. The facility list is a proxy and is not a clinical certification. Tamil and Hindi text are **draft translations** until reviewed.

## Standing data gaps
1. No public verified list of FRU/CEmONC facilities with coordinates exists for Chennai.
2. No 108 ambulance data is public; ambulance starts and times are simulated.
3. No open flood extent exists for the 1-4 Dec 2015 peak; the observed scenario is a composite of available layers.
4. Current OpenStreetMap roads differ from 2015 roads.

## Setup

### Just running the web app (clean clone, no data download)
The data the web app reads (`web/public/data/`, `web/src/i18n/`, `web/src/data/config.json`) is
**committed to this repo**, so a fresh clone runs without installing Python or any raw dataset:
```
cd web
npm install
npm run dev        # http://localhost:3000  (add ?lang=ta or ?lang=hi)
npm run build
```

### Rebuilding the data from source
Only needed to change the analysis itself (flood thresholds, routing, scenarios, metrics).
Needs internet once (OpenStreetMap roads, cached after the first run) and the raw datasets in
`data/raw/` (see `SOURCES.md`; not committed, third-party licences: UNOSAT CC BY-NC-SA, OSM ODbL,
OpenCity).
```
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.lock.txt
.venv\Scripts\python -m pytest
.venv\Scripts\python scripts\build_all.py
```
`build_all.py` runs, in order: `build_phase2` (road graph, flood layers/scenarios), `build_phase3`
(facilities, sample origins, ambulance starts), `build_wards` (Census 2011 ward join),
`build_metrics`, `build_routes`, `build_isolation`, `build_audit`, then the two `export_web_*`
scripts that copy Python's `i18n/` and `config.py` into `web/src/`. Commit `web/public/data/` and
`web/src/` after running it. CI (`.github/workflows/ci.yml`) runs the Python tests and builds the
web app on every push, but does not re-run `build_all.py` (the raw datasets aren't in CI, by
licence) — it instead fails if the committed data under `web/public/data/` is missing.

Python note: the blueprint says 3.11; this machine has Python 3.13 only. The pinned packages installed on 3.13 without errors; behaviour on 3.11 is untested. The web app uses Node 22+; `next/font` downloads Inter and IBM Plex Mono once at dev or build time (needs internet).

## Layout
`config.py` (assumptions), `src/` (Python modules), `i18n/` (English, Tamil, Hindi, the source of truth), `web/` (Next.js interface), `tests/`, `docs/`, `data/raw/` (ignored), `data/processed/`.

## Interface style
The interface follows a supplied reference dashboard image (floating icon rail with a round logo, large raised cards, pill toggles, KPI cards, 3 x 2 card grid) in a **blue** palette instead of the image's teal. A second reference website (shpp3.vercel.app) was reviewed and its thin-border style was not adopted. See blueprint Section 6.13.

## Ward data (optional, enables population weights)
Download two small public files into `data/raw/wards/` (not committed): `Wards-2008.geojson` from `github.com/datameet/Municipal_Spatial_Data` (folder `Chennai`, CC BY-SA 2.5 India) and the OpenCity "Chennai - Ward-wise Census Data - 2011" CSV saved as `census2011_ward.csv` (`data.opencity.in`, dataset `chennai-census-2011-data`). Then run `python scripts/build_wards.py` and re-run `build_phase3.py`, `build_metrics.py`, `build_routes.py`, `build_isolation.py`, `build_audit.py`. Without the files everything still works with a 1 km grid and placeholder weights.
