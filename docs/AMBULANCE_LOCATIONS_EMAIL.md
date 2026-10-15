# Ambulance base-location email

Purpose: ask for real 108 (Tamil Nadu Emergency Management & Research Institute / GVK EMRI) ambulance
base/parking locations in the study zone, so the app's 6 simulated ambulance start points can be
replaced with real ones, or at least checked against them (see
`FloodPath-Care_Required_Changes.pdf`, Section 3). This is a straightforward public-interest ask —
you are not asking for live tracking or operational data, only where ambulances are based when idle.

## What you're asking for (be specific)

- The approximate number and locations (locality or station name is enough; exact street address
  is a bonus) of 108 ambulance bases/parking points inside or near the study zone: **central
  Chennai, bounded roughly by Purasaiwalkam in the north, Saidapet in the south, bbox
  80.205-80.270°E, 13.010-13.100°N** (you can also just name it "the zone covering T. Nagar,
  Nungambakkam, Egmore, Kilpauk, Shenoy Nagar, Purasaiwalkam, Saidapet").
- Not real-time GPS positions, not dispatch logs, not patient data — just where units are
  stationed when not on a call. This is the kind of information 108 services often publish or
  share for planning/academic purposes, since it does not touch any individual case.

If they decline to share exact locations (reasonable, for operational-security reasons), ask for
a count per zone/ward instead, or confirm whether your 6 simulated points are at least a
plausible density and spread, without needing exact coordinates.

## Who to send it to

In order of preference:
1. **GVK EMRI Tamil Nadu (108 service operator)** — the organisation that actually runs the fleet.
   Look up their current Tamil Nadu office/press contact; they are used to academic and media
   enquiries about 108.
2. **Tamil Nadu Health & Family Welfare Department** (oversees 108) — if GVK EMRI doesn't reply or
   redirects you.
3. **104 (Tamil Nadu health helpline)** — can sometimes route an enquiry to the right desk.

## Email

**Subject:** Student request: approximate 108 ambulance base locations in central Chennai —
civic project

**Body:**

> Dear Sir/Madam,
>
> I am a student at Sathyabama Institute of Science and Technology, Chennai, working on a civic
> technology project for the Seva First Innovation Challenge 2026. The project models flood-aware
> emergency ambulance routing to maternity facilities in central Chennai, and currently uses
> simulated ambulance start points because no public source for real 108 base locations was
> available to me.
>
> Could you kindly help with either of the following, whichever is easier to share?
>
> 1. The approximate number and locations (locality or station name is sufficient; an exact
>    address is a bonus, but not required) of 108 ambulance bases or parking points within or near
>    central Chennai — specifically the area covering T. Nagar, Nungambakkam, Egmore, Kilpauk,
>    Shenoy Nagar, Purasaiwalkam and Saidapet.
> 2. If exact locations cannot be shared, a rough count per zone or ward, so I can check whether
>    my current simulated points (6 points, seeded at random road locations) are a reasonable
>    stand-in in terms of number and spread.
>
> I am not asking for live vehicle positions, dispatch records, or any patient-related
> information — only where units are based when idle, for the purpose of making the simulation
> more realistic.
>
> This is an academic prototype, not an official survey or audit. Any information you share would
> be labelled in the project as "real 108 base locations, confirmed by [organisation], [date]"
> rather than simulated, and I would be glad to share the published project with you once
> complete.
>
> Could I also confirm your name and designation, for citing this correctly?
>
> Thank you for your time.
>
> [Your name]
> [Your phone number / student email]
> Sathyabama Institute of Science and Technology

## If they decline or don't reply

That's a legitimate outcome, not a dead end — the app can say so explicitly instead of silently
keeping simulated points. Tell me what response you got (even "no response after N weeks" or
"declined, cited operational security") and I will:
- Add a line to the Data and limits page and `docs/DATA_LIMITS.md` stating that real 108 base
  locations were requested from [organisation] on [date] and [were shared / were declined /
  received no response], so ambulance start points remain simulated for a stated reason, not an
  unexplained gap.

## If they do share locations

Send me what you get (even informal, e.g. "roughly 2 units near T. Nagar, 1 near Egmore") and I
will:
- `src/facilities.py: load_ambulance_starts()` currently rejects any row whose `label` isn't
  exactly `simulated` — that check exists to stop a real point from silently looking the same as a
  simulated one, so it needs a small, deliberate code change (a `real` label, plus a source/date
  column) before real points can be loaded, not a plain CSV edit.
- Once that's in, replace or supplement the 6 simulated points in `data/ambulance_starts.csv`
  with the real ones and re-run `scripts/build_phase3.py` onward.
- Update the UI's "simulated" tags on the map and Route explorer for the affected points, and the
  audit log / Data and limits page to cite the source and date.
