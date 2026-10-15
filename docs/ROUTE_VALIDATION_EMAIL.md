# Route validation email

Purpose: get an independent check on one or two specific routes the model produces, against real
2015 flood conditions and real road geometry, so at least one result in the app can be called
validated rather than simulated (see `FloodPath-Care_Required_Changes.pdf`, Section 3). This is a
smaller ask than facility verification: you are not asking anyone to certify the whole model, only
to confirm or deny flooding on one short, named stretch of road during a specific week.

## Picking the route to validate (do this before sending)

Pick 1-2 of the model's routes where the flooded and unflooded paths actually differ (otherwise
there is nothing distinctive to confirm). Open the Route explorer page in the app
(`?page=route`), choose the **severe** or **moderate** scenario, and pick an origin where the
"Compare" view shows the flood-aware path taking a visibly different road than the conventional
one. Note:
- The origin's and the diverted road's approximate location (street/locality name if you
  recognise it from the map, otherwise just the pin).
- A Google Maps link for the start point and for the point where the two paths diverge — right-
  click the point on Google Maps and choose "What's here?", or use
  `https://www.google.com/maps?q=<lat>,<lon>` with the coordinates from the app's Route explorer
  (hover a point to see its lat/lon, or read them from the Export page's CSV).
- The flood scenario (mild/moderate/severe = 8%/16%/25% of reports) and the date range you're
  asking about: 1-4 December 2015 (the reported peak of the Chennai floods).

The email below has placeholders in `[brackets]` for these.

## Who to send it to

In order of preference:
1. **Greater Chennai Corporation (GCC) Disaster Management Cell / your ward's Zonal office** —
   most likely to have 2015 flood records for a specific road or locality.
2. **The ward's corporator's office** — often has local knowledge even without formal records.
3. **A newspaper that covered the 2015 floods in depth** (e.g. The Hindu, Times of India Chennai
   desk) — ask if their archive or a reporter who covered it can confirm a specific road.
4. **A local residents' welfare association (RWA)** for the locality, if you can find contact
   details — residents who were there in 2015 are a legitimate, if informal, source; just label
   the answer as residents' recollection, not an official record.

Send one email per route (not combined) if you're asking more than one recipient, so a reply is
unambiguous about which route it answers.

## Email

**Subject:** Request to confirm December 2015 flood conditions on [road/locality name or "a
specific road, pin attached"] — student civic project

**Body:**

> Dear Sir/Madam,
>
> I am a student at Sathyabama Institute of Science and Technology, Chennai, working on a civic
> technology project for the Seva First Innovation Challenge 2026. The project models flood-aware
> emergency routing in central Chennai using publicly available 2015 flood data (NRSC inundation
> extent, GCC stagnation points and hotspots, and crowd-sourced reports), and I would like to
> validate one of its results against an independent source rather than rely on the model alone.
>
> Could you kindly help confirm whether the following road / stretch was flooded or impassable
> during the peak of the December 2015 Chennai floods (roughly 1-4 December 2015)?
>
> - **Location:** [road/locality name, or "see pin"] — [Google Maps link,
>   e.g. https://www.google.com/maps?q=13.0738,80.2448]
> - **What I'm trying to confirm:** whether this stretch was flooded or blocked to vehicle
>   traffic during that week, and if you have it, roughly how many days it stayed that way.
> - **Why it matters for this project:** the model currently classifies this road as
>   [passable/at-risk/blocked] under its "25% of reports blocked" (severe) scenario, based on a
>   seeded subset of crowd-sourced reports, not a verified record. A confirmation either way helps
>   me state accurately whether the model's output matches what actually happened.
>
> This is an academic prototype, not an official survey or audit. Any information you can share —
> even an informal recollection rather than a formal record — would be cited in the project's
> documentation with your name/designation (or kept anonymous, if you prefer) and a note that it
> is not an official record unless you say otherwise.
>
> Could I also confirm your name and designation, for citing this correctly?
>
> Thank you for your time.
>
> [Your name]
> [Your phone number / student email]
> Sathyabama Institute of Science and Technology

## After a reply: write up the result

Whatever the answer — confirms the model, contradicts it, or is inconclusive — record it in
`docs/VALIDATION.md` (create it if it doesn't exist) with:
- The route (origin, facility, scenario) and the specific road/location asked about.
- Who answered, their designation, and the date.
- What they said, quoted or closely paraphrased.
- Whether it matches the model's classification for that road, and if not, say so plainly rather
  than reframing the mismatch as a success.

One validated route, confirmed or clearly contradicted, is worth more to the submission than
several more unverified ones — tell me what comes back and I'll help write up
`docs/VALIDATION.md` and update the Data and limits page to cite it.
