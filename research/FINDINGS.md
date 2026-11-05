# Liste čekanja — research findings (5 Nov 2026)

## 1. liste.cezih.hr — how it works

ASP.NET MVC site run by HZZO. Data is refreshed **every 2 hours** (per the site). It has no official API, but it has these endpoints:

| Endpoint | Returns |
|---|---|
| `GET /Home/DohvatZahvata?query=` | JSON: all **815 procedures** `{Id, Naziv}` |
| `GET /Home/DohvatUstanova?query=` | JSON: all **365 institutions** `{Id, Naziv}` |
| `GET /Home/DohvatRegija?query=` | JSON: **20 regions** (`Id` like `"082"`). Grad Zagreb + Zagrebačka are merged into `"114"` |
| `GET /PrviTermin?pId=&regId=` | HTML: the next 20 free slots across institutions |
| `GET /Postupak?pId=&regId=` | HTML: per institution → first 5 slots, days waiting, contacts, last update |
| `GET /Ustanova?uId=` | HTML: one institution → every procedure + slots, days, last update, contact block |

**Gaps in the source:**
- **No coordinates. Addresses are nearly always empty** (2/365 filled). Location has to come from somewhere else.
- **Only 130 of 365 institutions publish any list.** The rest are listed but have no data (mostly private dental/orthodontic practices, DZ units).
- The "days waiting" figure is the first free slot in the e-booking calendar. It is **not** the real wait time patients experience.

## 2. Snapshot collected (`data/`)

| File | Contents |
|---|---|
| `procedures.json`, `institutions.json`, `regions.json` | Raw lookup lists |
| `snapshot_by_institution.json` | **10,810 rows** (institution × procedure): slots, `dani_cekanja`, `azurirano`, contact info |
| `settlements.json` | **11,609 Croatian settlements** with lat/lon, population and CEZIH `regId`/županija (GeoNames, CC-BY) |
| `institutions_geo.json` | First-pass location guess per institution, based on the town name inside the institution name |
| `geo_raw/pc/HR.txt` | Postal codes mapped to place and coordinates (6,774 rows) |

Stats: median wait **28 days**, p90 **195 days**, max **789 days**. Automatic geocoding placed **84 of the 130** publishing institutions. The other ~46 (e.g. Klinika Magdalena, SB Naftalan, private ortho practices) need manual curation. That is a one-off job of about an hour.

Scripts: `scrape_cezih.py` (full snapshot, ~6 min at 1 req/s), `build_geo.py`, `analyze.py`.

## 3. Existing tools — **this has been built already**

### Nađi termin — https://listacekanja.vibecoding.hr (was listacekanja.replit.app)
It is almost exactly the concept: procedure → city (or GPS) → ranked results. Tested with "Kardiologija – Prvi pregled" + Bjelovar:
- **"Najbliže tebi"**: OB Bjelovar, 271 days
- **"Najbolja kombinacija"**: SB Krapinske Toplice, 81 km / ~1h29, 48 days → "+81 km → 223 days earlier"
- **"Apsolutno najranije"**: Dubrovnik, 375 km, 1 day
- Sort by distance or by date, driving time, "call directly" for institutions that don't publish, an error-report button, and an explainer on patients' rights (priority referral, 4-week rule for oncology).
- It also has an institution directory and an analysis page ("Najdulje čekamo ono od čega najčešće umiremo"). Author: Ivan Ivanković. It is a solo, non-commercial project.

### poliklinike.hr/liste-cekanja
A national "shortest wait" figure per service plus a city field. There are no per-institution distances. It is a directory of private polyclinics, so it is commercially motivated.

### No open-source scraper found on GitHub.

## 4. Other useful sources
- **data.gov.hr – Popis županija / općina i gradova**: an authoritative municipality → county mapping.
- **HZZO "Lokacije ordinacija PZZ-a"** (data.gov.hr, updated Apr 2026): primary-care locations. The `hzzo-net.hr` download host was **unreachable** today.
- **Nominatim / OpenStreetMap**: for geocoding the ~130 publishing institutions (one-time, cache the results).
- **OSRM** (public or self-hosted): real driving time instead of straight-line km.
- **Pravilnik / NN**: maximum acceptable waiting times (priority = 7 days, oncology = 4 weeks), useful for a "within legal deadline?" indicator.
- **Policy context**: the Ministry plans to split "lista rezervacija" from "lista čekanja" and add a monitoring module (DDRM). This may change how the data is labelled; watch the CEZIH markup for changes.

## 5. Implications for our plan
To be worth building, ours has to beat Nađi termin on something specific. Candidate angles:
1. **County-first UX**, as you described: auto-detect the županija and show "best in your county" vs. "best nationally".
2. **Explicit trade-off score**: user-tunable "how many km is one day of waiting worth to me?" slider, or a max-distance radius.
3. **Alerts**: "notify me when Kardiologija in ≤50 km drops below 30 days". We can do this because we can snapshot every 2 h.
4. **History/trends** per institution (Nađi termin shows only the current snapshot).
5. Public transport time (the elderly often don't drive), accessibility, and simpler wording for older users.
6. Or **contribute** to or partner with the existing project instead.
