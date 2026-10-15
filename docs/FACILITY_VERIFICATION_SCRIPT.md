# Facility verification call script

Purpose: confirm, for each of the 5 candidate facilities in `data/facilities.csv`, whether it
actually offers 24x7 emergency obstetric care, so the "unverified" label in the app can become
either "verified" (with a date and a name) or "excluded" (if it does not qualify). This is the
single highest-value item left on the project (see `FloodPath-Care_Required_Changes.pdf`,
Section 3) — a validated fact beats any further dashboard feature.

Call the Chennai Corporation (GCC) Health Department first if possible; it may be able to confirm
several units at once and point you to the right person at each site. GCC Health Department
helpline / Ward office numbers change; look up the current one for the zone (Zone 7/8/9, Central
Chennai) before calling, or ask 104 (Tamil Nadu health helpline) to route you.

## What "counts" as confirmed

A facility is CEmONC-capable (comprehensive emergency obstetric care) only if it can do all four:
1. Deliveries around the clock, every day (not just OPD hours).
2. Caesarean section on site, or a working referral/transport link to one with a guaranteed time.
3. Blood transfusion available on site, or a blood bank tie-up with same-facility access.
4. A doctor or nurse able to manage an obstetric emergency physically present at night and on
   weekends (not on-call from home).

If a facility offers normal delivery only, or caesarean but no blood bank, record exactly what it
does offer — that's still useful, just not full CEmONC. Don't round up.

## Opening line (use for every call)

> "Hello, I'm a student from Sathyabama working on a civic project about flood-safe emergency
> routing to maternity facilities in Chennai, for the Seva First Innovation Challenge. I'd like to
> ask a few quick questions about the emergency obstetric services at [facility name] — is there
> someone who can help, like the duty doctor, nursing in-charge, or medical officer?"

If asked why: "It's an academic prototype, not an official survey — I want to label our facility
list accurately instead of guessing."

## Questions (ask in this order; stop early if the answer is already "no")

1. "Does [facility name] provide delivery services 24 hours a day, every day of the week,
   including nights and weekends?" → if no, note it and move to the closing question.
2. "If a delivery needs a caesarean section, is that done on site, or is the patient referred
   elsewhere? If referred, which facility, and roughly how long does that transfer take?"
3. "Is blood available on site for a transfusion during delivery, or is there a tie-up with a
   blood bank? Which one?"
4. "At night and on weekends, is a doctor physically present at the facility, or on call from
   home?"
5. "Roughly how many deliveries does the facility handle in a typical month?" (sanity check on
   scale; not required for the CEmONC classification.)
6. Closing: "Thank you — can I confirm your name and designation, and today's date, for our
   records?" Record the person's name, designation, phone number called, and the date/time.

## After each call: fill in one row per facility

Keep this table (or update `data/facilities.csv` directly — see the column mapping below) as each
call finishes.

| Facility (facility_id) | Called on | Person, designation | 24x7 delivery? | C-section on site? | Blood on site/tie-up? | Doctor present at night? | Verdict | Notes |
|---|---|---|---|---|---|---|---|---|
| F01 Purasaiwalkam (EOCU_GCHM1) | | | | | | | | |
| F02 Shenoy Nagar (EOCU_GCHM2) | | | | | | | | |
| F03 Saidapet (EOCU_GCHM3) | | | | | | | | |
| F04 Mugalivakkam (EOCU_GCHM4) | | | | | | | | |
| F05 Thoraipakkam (EOCU_GCHM5) | | | | | | | | |

Verdict is one of: **CEmONC confirmed** (→ `phone_verified` in the CSV) / **partial, say what it
offers** (→ stays `unverified`, flag to me) / **could not confirm** (e.g. no one available, number
not working; stays `unverified`) / **does not qualify** (e.g. OPD only; flag to me for exclusion).

## Updating the data after calls are done

`data/facilities.csv`'s `verification_status` column currently only accepts three values:
`unverified`, `source_listed`, `phone_verified` (`src/facilities.py` rejects anything else). After
your calls:
- Full CEmONC confirmed by phone → set `verification_status` to `phone_verified` and
  `verified_on` to the call date, e.g. `2026-10-20`.
- Partial (offers some but not all four points) or could not confirm → **leave as `unverified`**
  for now, but still fill in `notes` with exactly what you found (e.g. "Called 2026-10-20, spoke
  to Nurse Y: 24x7 delivery confirmed, but C-section referred to Govt RGGGH, ~20 min transfer, no
  on-site blood bank."). Tell me what you found — a facility that's only partially capable needs a
  real "partial" status and matching UI copy, which is a small code change I'll add once there's
  an actual case to model it on, not a value to invent now.
- `notes`: always record the name + designation of the person who confirmed it, and what exactly
  was confirmed, even when the status stays `unverified`.

If a facility does not qualify at all (e.g. OPD-only, no emergency delivery), tell me — the routing
should exclude it the same way F04/F05 are already excluded for being outside the road-graph snap
distance, and the UI copy should say so plainly instead of silently dropping it.

## If a facility can't be reached

Try the GCC Zonal Health Officer for that zone, or the Tamil Nadu 104 helpline, and ask them to
confirm the four points above on the facility's behalf. Record who you asked and what they said,
even if it's secondhand — "could not confirm directly" is itself useful information for the
Data and limits page, and is better than leaving the unverified label unexplained.

## What this changes in the app once done

Once `data/facilities.csv` has at least one `verified` or `partial` row with a date and a name,
tell me and I will:
- Update the UI copy from "candidate facilities (unverified)" to reflect the real mix of
  verified/partial/unverified facilities.
- Re-run `scripts/build_phase3.py` onward so the audit log and Data and limits page show the
  verification source and date for each facility.
- If any facility is excluded for not qualifying, re-run routing without it and note the change
  in `docs/DATA_LIMITS.md`.
