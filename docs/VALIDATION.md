# Validation log

Every entry below is a real-world check on the prototype, not a simulation result. An entry is
added only after an actual phone call, email reply, or independent comparison — never written in
advance of one. This file exists so the project's claims can point at evidence instead of staying
"indicative" by default; see `FloodPath-Care_Required_Changes.pdf`, Section 3, and the three
outreach templates it produced: `docs/FACILITY_VERIFICATION_SCRIPT.md`,
`docs/ROUTE_VALIDATION_EMAIL.md`, `docs/AMBULANCE_LOCATIONS_EMAIL.md`.

**Status as of [date]:** 0 of 5 facilities verified. 0 of 1-2 target routes validated. Ambulance
base locations: not yet requested / requested, awaiting reply / declined / received.
(Keep this one-line status current at the top so it is the single place anyone can check progress
without reading the whole file.)

Record an outcome here even when it contradicts the model or the request is declined — a
documented contradiction or a documented "no" is useful; an undocumented gap is not.

---

## 1. Facility verification

One entry per facility that was actually called or emailed, using
`docs/FACILITY_VERIFICATION_SCRIPT.md`. Copy this block per facility.

### [facility_id] [facility name]
- **Method:** call / email
- **Date:** [date]
- **Contacted:** [name, designation, phone/email used]
- **24x7 delivery:** [yes / no / partial, detail]
- **C-section:** [on site / referred to X, ~Y min transfer / unknown]
- **Blood on site or tie-up:** [detail]
- **Overnight staff presence:** [doctor present / on-call from home / unknown]
- **Verdict:** CEmONC confirmed / partial / could not confirm / does not qualify
- **Action taken:** [e.g. "set verification_status=phone_verified, verified_on=2026-10-20 in
  data/facilities.csv" / "left as unverified, noted partial capability" / "flagged for exclusion"]

(Repeat for each of F01-F05 that was contacted. Facilities not yet contacted are not listed here;
they remain `unverified` in `data/facilities.csv` with no entry required until contacted.)

---

## 2. Route validation

One entry per route checked against an independent source, using
`docs/ROUTE_VALIDATION_EMAIL.md`. Copy this block per route.

### Route: [origin id] -> [facility id], scenario [mild/moderate/severe]
- **Location asked about:** [road/locality name or coordinates]
- **Google Maps reference:** [link]
- **Model's classification:** [passable / at-risk / blocked] under this scenario
- **Asked:** [who — organisation, name, designation]
- **Date asked / date answered:**
- **What they said:** [quote or close paraphrase]
- **Match with the model:** confirms / contradicts / inconclusive
- **Write-up:** [one or two sentences for the Data and limits page — state a contradiction as
  plainly as a confirmation]

(If a route comes back inconclusive or contradicted, say so in the app's "Data and limits" page
rather than omitting it — a documented mismatch is more credible than silence.)

---

## 3. Ambulance base locations

Using `docs/AMBULANCE_LOCATIONS_EMAIL.md`.

- **Asked:** [organisation, e.g. GVK EMRI Tamil Nadu]
- **Date asked:**
- **Outcome:** declined (reason given: [...]) / no response after [N weeks] / shared: [summary of
  what was shared]
- **Action taken:**
  - If declined or no response: added a stated-reason note to `docs/DATA_LIMITS.md` (do this
    regardless of outcome, so simulated points have an explained reason, not a silent gap).
  - If shared: [describe what changed — e.g. "code change to load_ambulance_starts() to accept a
    `real` label landed in commit [hash]; data/ambulance_starts.csv updated with N real points,
    M still simulated"].

---

## How to add an entry

1. Do the call, email exchange, or comparison first — never write an entry speculatively.
2. Copy the matching block above, fill it in, and update the status line at the top of this file.
3. Tell me what came back. I will, as applicable: update `data/facilities.csv` or
   `data/ambulance_starts.csv`, re-run the affected build scripts, update the UI copy and audit
   log, and add a citation to the Data and limits page.
