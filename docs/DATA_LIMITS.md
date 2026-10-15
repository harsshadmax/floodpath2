# Data limits and PHASE 1 findings

Everything here was observed by opening the downloaded files on 2026-10-13 (`scripts/inspect_kml.py`, `scripts/choose_zone.py`, `scripts/zone_check2.py`).

## Standing gaps (always shown in the app)
1. No public verified list of FRU/CEmONC facilities with coordinates exists for Chennai. The facility list is a hand-checked proxy and not a clinical certification.
2. No 108 ambulance data is public. Ambulance starts and times are simulated.
3. No open flood extent exists for the 1-4 Dec 2015 peak. The "observed" scenario is a composite of available layers.
4. OpenStreetMap roads are current roads, not 2015 roads.

## What the files actually contain (differences from the blueprint's assumptions)
| Finding | Detail | How the build handles it |
|---|---|---|
| The crowd-sourced flooding layer is **lines**, not points | 7,894 features: 7,856 LineString and 38 MultiLineString; read as flooded street segments | Buffered by `LINE_BUFFER_M` (assumption A-22), not `POINT_BUFFER_M` |
| **No dates** on any flood layer | The `timestamp`, `begin` and `end` fields are empty in all files | Flood layer `date` is recorded as "2015 event (day unknown)" |
| The NRSC inundation layer covers far more than Chennai | 4,001 MultiPolygons spanning 79.35-80.32 E, 12.52-13.33 N; its observation date and sensor are not stated in the file | Clipped to the study zone |
| District hotspot files contain stray points | The Tiruvallur "hotspots" span 78.56-80.33 E and 9.67-13.53 N (it reaches southern Tamil Nadu) | Clipped to the study zone; points outside are ignored |
| The maternity file has **no facility names** | The `Name` field is empty. The file has `ADDRESS`, `ASSET_NAME` (all "UCHC"), `FINAL_CODE` (EOCU_GCHM1 to EOCU_GCHM5) and `TYPE` ("MATERNITY HOSPITALS/EMERGENCY OBSTETRIC CARE UNITS(24 X 7)") | Facility names are derived from the address locality plus the code; the original address is kept in `notes` |
| Only 3 of 5 maternity points fall in the study zone | Shenoy Nagar, Saidapet and Purasaiwalkam are inside; Thoraipakkam and Mugalivakkam are outside | Zone satisfies the "at least 3 facilities" rule |

## Study zone chosen
Central Chennai, bbox W 80.205, S 13.010, E 80.270, N 13.100 (about 70 km2). Inside it: 3 facilities, 217 GCC stagnation points, 87 GCC hotspots, 2,139 crowd-sourced flooded street segments, and about 39% of its area lies within NRSC inundation polygons. Compared with larger zones the coverage of flood data is higher and the road graph is smaller (zone A south corridor 187 km2, 21% inundated; zone B central 132 km2, 31%). This is a decision the user can change at the first preview.

## Decisions taken under the 2-hour plan
- **Ward population join skipped.** Census 2011 (155 wards) and DataMeet ward polygons (201 features) were not downloaded or joined. Population coverage therefore uses equal sample-point weights and shows the placeholder notice (blueprint Section 2.4). It is a share of sample points, not of people.
- **Only the 5 GCC emergency obstetric units are candidate facilities** (3 inside the zone). The 4 NHM-listed CEmONC hospitals are not included (no coordinates). All facilities are `unverified`; no phone verification was done.

## PHASE 2 findings (2026-10-13)
- **Road graph (OpenStreetMap, today's roads):** 12,330 nodes, 30,403 directed edges, 2,241 km of drivable road in the zone, 63 strongly connected components (the largest holds 12,214 nodes, 99.1%). Built in 18 s; cached as `data/processed/roads.graphml` (not committed).
- **Flood layer areas inside the zone (km2, before union):** NRSC inundation polygons 27.5; GCC stagnation points (buffered 75 m) 3.6; GCC hotspots (75 m) 1.4; crowd-sourced flooded street segments (buffered 25 m) 20.8. Feature counts in the zone: 290 polygons, 217 stagnation points, 87 hotspots, 2,139 street segments. The three district hotspot files are not used.
- **Observed composite:** 41.6 km2, which is 59.2% of the 70.2 km2 zone. It is a union of the layers above, not one observation, and not the 1-4 Dec 2015 peak. The union also hides how much of it rests on low-confidence buffered points and lines (about 26 km2 of the inputs before overlaps are merged).
- **Scenario buffers recalibrated.** The first guess (-100, 0, +150 m) gave mild = 1.6% and severe = 99.5% of the zone. `scripts/calibrate_scenarios.py` measured area against buffer; the values now used are -15, +10 and +30 m, giving mild 28.4 km2 (40.4%), moderate 49.0 km2 (69.9%) and severe 59.1 km2 (84.2%) against 41.6 km2 (59.2%) observed. These are arbitrary sensitivity settings chosen so the scenarios differ usefully, not physical flood models, and they say nothing about real depths or extents.
- **Map basemap:** OpenStreetMap raster tiles from tile.openstreetmap.org (light demo use; attribution shown). Basemap labels stay in the tile provider's language and cannot follow the interface language.
- **Web data size:** `roads.geojson` is about 5.5 MB (simplified to 3 m); flood layers 0.2 to 0.4 MB each. All are generated into `web/public/data/` (gitignored).

## Licence conflicts
See `SOURCES.md`: OpenCity's dataset-level Public Domain tag versus its portal-wide CC BY-NC-SA 4.0 and ODbL statement.

## PHASE 3 findings (2026-10-13): scenarios redesigned, routing built
- **Buffered scenarios made the road network collapse.** With the observed composite, 71% of road length is classed blocked (22,010 of 30,403 edges), all three facilities are cut off, and none of the 20 sample origins can reach any facility. Single layers did the same: the NRSC inundation polygons alone block 41% of road length, the street-level reports 47%. Shrinking the composite does not help, because buffered lines are about 50 m wide and vanish (-100 m left 1.1 km2).
- **Decision (user, option 1):** mild, moderate and severe are now seeded, nested subsets of the street-level flood reports (GCC stagnation points, GCC hotspots, crowd-sourced flooded segments): 10%, 20% and 35% of reports (`SCENARIO_FEATURE_SHARE`, seed 42). Areas: mild 3.2 km2, moderate 6.3 km2, severe 10.2 km2. The observed composite (41.6 km2) is still drawn on the map but is not routed on. These shares are arbitrary sensitivity settings, not physical models and not predictions. The NRSC inundation polygons are not used in the simulated scenarios.
- **Edge classes (30,403 directed edges):** mild 26,926 passable / 1,383 at risk / 2,094 blocked; moderate 23,707 / 2,481 / 4,215; severe 19,931 / 3,687 / 6,785. The at-risk and blocked thresholds (10% and 50% of edge length flooded) and the 3x time multiplier are assumptions.
- **Facilities:** only 3 of the 5 GCC emergency obstetric units fall on the road graph (Purasaiwalkam, Shenoy Nagar, Saidapet, snapped 24, 26 and 94 m); Thoraipakkam and Mugalivakkam are outside the zone and are excluded with the reason `OUTSIDE_ROAD_GRAPH_SNAP_TOO_FAR`. All are unverified. With only 3 facilities, one cut-off unit changes results sharply (in the severe subset, all 20 sample origins lose access; mild and moderate leave 19 of 20 with access).
- **Sample origins:** 20 seeded nodes from the largest connected road component. All 20 fall within 300 m of the observed composite because the composite covers 59% of the zone, so the "flood-adjacent" stratification is trivially met and does not add a stricter test.
- **Ambulance starts:** 6 seeded points, all labelled simulated (`data/ambulance_starts.csv`).
- **Speed:** classifying 30,403 edges took 106 s against the whole flood polygon; cutting the polygon into 400 m grid pieces made it a few seconds.
- **Not yet done:** metrics K1 to K5, robustness runs, explanation text, audit log, route explorer and the KPI cards are still to build.

## PHASE 7 findings (2026-10-13): metrics and KPI cards
Computed by `scripts/build_metrics.py` for the 3 simulated scenarios on 20 seeded sample origins and the 3 on-graph facilities (all unverified). The observed composite is not routed on.

| Metric | Mild (10% of reports) | Moderate (20%) | Severe (35%) |
|---|---|---|---|
| Travel-time increase (origins with both routes) | +0.19 min mean, 0.96 max (5 origins) | none (no origin has a drivable conventional route and a flood-aware route) | none |
| Conventional routes crossing a blocked road | 75% | 100% | 100% |
| Origins reaching a facility | 95% (19 of 20) | 95% | 0% |
| Coverage within 30 min, flood-aware (conventional) | 95% (25%) | 85% (0%) | 0% (0%) |
| Routing robustness (50 runs) | 44.9% | 41.7% | 43.6% |

How to read these:
- **Cliff, not a gradient.** Reachability depends on whether one or two road segments next to a facility node are blocked. In moderate, only F01 (Purasaiwalkam) is reachable (95%) while F02 and F03 are cut off; in severe all three are. A 35% subset is therefore not "worse by a smooth amount"; it crosses a threshold.
- **Robustness is low (42 to 45%).** The robustness runs draw the share of reports kept between 5% and 40%, which spans the cliff, so origins often change facility. This measures sensitivity to the assumed flood extent under this simplified design; it is not a measure of routing quality.
- **Conventional routes look worse than they are.** The 100% false-route rate and 0% conventional coverage in moderate and severe come from sample origins that are all within 300 m of flooded areas and from a network where a single blocked edge breaks a route. Origins elsewhere in the city were not sampled.
- **Coverage is a share of sample points, not of people** (placeholder weights; ward population join skipped).
- **Free-flow speeds**, so minutes are comparative, not real response times (assumption A-05).

## PHASE 8 findings (2026-10-13): isolation view, metrics table, export page
- **Units are 1 km grid cells, not wards.** The ward polygons and Census 2011 populations were never loaded (the join was cut from the 2-hour plan, and downloading them needs separate approval). All 79 cells that have at least 5 eligible road nodes carry the placeholder population weight 1.0, so the ranking follows the share of road nodes cut off, not people, and the "people" column is a share of sample points. The Section 5.7.5 worked example (ranks Z, X, Y) is reproduced by test T-22 on the ranking function.
- **Results (isolated share of road nodes):** mild: 67 of 79 cells have at least one isolated node, top cell r1c7 at 100%; moderate: 72 of 79, three cells at 100%; severe: all 79 cells, every cell at or near 100% (all three facilities are cut off, so the ranking cannot separate cells). 56 road nodes cannot reach any facility even without flooding and are excluded.
- **Node share overstates isolation.** One blocked road next to a dead-end street isolates its nodes, so most cells show some isolation even in the mild scenario. It is a proxy for streets, not people.
- **Rankings change a lot between scenarios** (for example r0c2 moves up 25 places from mild to moderate); the page shows this comparison instead of hiding it. No validation against reported cut-off areas was done (no reference list exists in the repository), and no accuracy figure is claimed.
- **Metrics table and exports** read the same JSON as the KPI cards. CSV files use English column names and carry `ui_language`.

## PHASE 8b findings (2026-10-13): ward join (supersedes the "skipped" notes above)
Two files were downloaded with the user's approval into `data/raw/wards/` (not committed): D8 `Wards-2008.geojson` (172,525 bytes, DataMeet / Transparent Chennai, CC BY-SA 2.5 India) and D7 the OpenCity ward-wise Census 2011 CSV (473,252 bytes, Public Domain tag). The newer 201-feature `Wards.geojson` is a different ward scheme and was not used.
- **The join worked: 155 of 155 polygons matched 155 census wards on ward number**, no unmatched ward on either side. The census table has 8,802 enumeration-block rows summing to 4,621,135 people. Not independently verified: that ward numbers in the two files refer to the same ward in every case (only the numbering range, the zone names and the plausible overall density were checked). The derived table is `data/wards_population.csv` (blueprint 3.6).
- **Study zone:** 95 wards touch the 70 km2 zone; 13 of them have less than a quarter of their area inside it. Each ward's population is scaled by the share of its area inside the zone (even spread assumed, A-15), giving about 1.94 million people in the zone (about 27,600 per km2, in line with Chennai's reported density).
- **Isolation view now uses wards:** 90 wards have at least 5 eligible road nodes and are ranked; estimated people in isolated areas = scaled population x isolated share of road nodes. Examples (moderate): Ward 138 at 100% isolated, about 32,000 people; the ranking changes strongly between scenarios (shown on the page). Still indicative: road-node share is not a share of people, and 2011 counts are old.
- **Coverage now weights the 20 sample origins by ward population.** Each origin gets its ward's in-zone population, shared equally by the origins in that ward (here every origin is in a different ward). Coverage within 30 minutes, flood-aware (conventional): mild 96.0% (25.7%), moderate 80.9% (0.0%), severe 0.0% (0.0%). This is a population-weighted share of 20 sample points, not of the city: wards with no sample origin contribute nothing.
- **Fallback kept:** if the files are missing or fewer than 90% of polygons match, every script falls back to the 1 km grid and placeholder weights, and the interface text changes accordingly.
- **Attribution:** ward boundaries credit DataMeet / Transparent Chennai (CC BY-SA 2.5 India); populations credit OpenCity / Census of India 2011. The Data and limits page lists both.

## PHASE 10 changes (supersede the notes above where they differ)
- **Scenario shares are now 8%, 16% and 25% of street-level reports** (a sweep showed the road network collapses between 25% and 30%). The observed composite is routed on as the extreme upper bound: every facility is cut off, every ward is 100% isolated, robustness is not defined for it.
- **Travel-time increase** is flood-aware time minus the unflooded shortest time for every origin that still reaches a facility (it no longer requires a drivable conventional route).
- Results (observed / mild / moderate / severe): facilities reached 0 / 95 / 95 / 85%; coverage within 30 min 0 / 96 / 96 / 69%; mean extra time none / 0.7 / 4.0 / 11.2 min. Still arbitrary sensitivity settings, not predictions.
- The "(simulated)" suffix was removed from scenario names and the event pill was removed; the simulation banner and "Simulated" caption tags stay.

## PHASE 11 changes (2026-10-15): reproducibility, sample size, confidence intervals
- **`web/public/data/` is now committed**, instead of git-ignored. A clean clone of this repo (`floodpath2`) runs the web app with `npm install && npm run build` alone; no Python, and none of the raw third-party datasets, are needed to see the site. `scripts/build_all.py` is the single entry point that reproduces this data from `data/raw/` (not committed; see SOURCES.md), and CI (`.github/workflows/ci.yml`) fails the build if the committed data goes missing.
- **Sample origins raised from 20 to 120, and population-weighted at the draw.** Previously 20 origins were drawn uniformly and then had a ward's population divided among however many origins happened to land in it (often one origin per ward). Now `sample_origins` draws with probability proportional to each node's ward population (`src/wards.py: node_population_weight`), so a populous ward is proportionally more likely to get an origin, before the same post-stratification weighting is applied. This does not remove the underlying limit (Census 2011 counts, evenly spread inside a ward) but makes the 120-point sample track population density instead of giving every ward one vote regardless of size.
- **Every headline KPI now carries a 90% confidence interval**, not just a point estimate: `src/metrics.py: bootstrap_ci` draws 300 weighted bootstrap resamples of the origin sample (same draw probabilities as above) and reports the 10th-90th percentile of the resulting statistic, for M1 (mean travel-time increase), M3 (reach-any) and M4 (coverage within 30 min). Shown in the KPI card notes and as extra rows in the metrics table and CSV export. This reflects sampling uncertainty from the 120-origin draw; it does not and cannot speak to the uncertainty in the underlying flood-extent or threshold assumptions (see the sensitivity-sweep gap below, still open).
- Updated results with the larger sample (observed / mild / moderate / severe): facilities reached 0 / 95.8 / 86.7 / 75.0%, 90% CI roughly +-3 to +-4 points; coverage within 30 min 0 / 96.8 / 86.0 / 53.5%; mean extra time none / 0.76 / 5.86 / 15.66 min. These differ from the PHASE 10 numbers because the sample changed (120 population-weighted origins instead of 20 uniform ones), not because the flood model changed.
- **Still open from the required-changes list:** a sensitivity sweep over the flood thresholds (10%/50% flooded, x3 delay) is not yet built; facility verification, route validation against real 2015 data, and real ambulance base locations still need the project owner or outside sources (see `FloodPath-Care_Required_Changes.pdf`).
