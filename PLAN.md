# Termin blizu — project plan

> Working title. A very simple site: *what do you need → where are you → where should you go.*

## 1. Goal
Help anyone in Croatia, especially older people and their adult children, find **where to get a referred exam soonest** in a few taps. Then help them **act on it** (call, or ask the GP to book it) and **get notified** when something better opens up.

Non-goals for v1: private clinics, accounts, history/research pages, languages other than Croatian.

## 2. User flow (v1)

### Screen 1: "Što trebaš?"
- One big search box with autocomplete over the CEZIH procedures. Search is **diacritic-insensitive** and **synonym-aware** ("magnet" → MR, "srce" → Kardiologija, "debelo crijevo" → Kolonoskopija).
- Chips for popular choices: MR, CT, UZV, Kardiolog, Kolonoskopija, Mamografija, Dermatolog, Oftalmolog.
- Hint: "Upiši naziv s uputnice".
- If the choice is ambiguous, a quick tap follow-up: *Prvi pregled / Kontrolni*, *Odrasli / Dijete*.
- Picking a *kontrolni* shows a note that control exams are usually booked where the first exam was.

### Screen 2: "Gdje si?"
- Main input: "Upiši mjesto", with autocomplete over 11,609 settlements. Shows the županija, so "Ivanić-Grad, Zagrebačka" is unambiguous.
- Secondary button: "Koristi moju lokaciju". The location stays on the device and is never sent anywhere.
- Town-level precision only. No street addresses.

### Screen 3: Results
- At the top: the procedure, the town and distance chips **25 · 50 · 100 km · Cijela HR** (default 50).
- Three cards:
  1. **Najbliže**: the closest location that publishes this procedure.
  2. **Najranije do X km**: the earliest first free slot within the chosen radius.
  3. **Najranije u Hrvatskoj**: the earliest anywhere, with an honest cost ("375 km · ≈ 5 h").
- When cards coincide, merge them ("Najbliže je ujedno i najranije").
- Each card shows: name, town, distance, **days until the first free slot**, the slot date, and "ažurirano prije X h".
- Each card's actions:
  - **Nazovi** (tel: link, with a one-line script to say).
  - **Pokaži liječniku** (a simple summary to show the GP, who books via eNaručivanje).
  - E-mail.
- "Comparison" sentence: "+34 km → 223 dana ranije".
- Full list below the cards, sortable by distance or by date.
- A section for **nearby institutions without published slots**, with a "nazovi i pitaj" contact.
- **Alert box**: "Javi mi kad se pojavi termin unutar [30] dana, do [50] km." It asks for an email address only.
- **Share** button (Web Share API, falling back to copy link).
- A short footer explainer on what the number means, the data source, and the disclaimer.

### Shareable URLs
- `/{procedure-slug}/{place-slug}?r=50`, e.g. `/kardiologija-prvi-pregled/bjelovar?r=50`.
- Every result is a link that can be sent on WhatsApp.

### Alerts
- Double opt-in: an email with a confirmation link. One-click unsubscribe in every email.
- Checked after every data refresh (every 2 h).
- Sends only when there is a **new, better** match (a different location or an earlier slot than the last one notified), **at most one email per day per alert**.
- Alerts **auto-expire after 90 days**. A reminder before expiry offers one-click renewal.
- Stored data: email, procedure id, lat/lon rounded to ~1 km, radius, max days, timestamps and token. Nothing else.

## 3. Architecture

```
GitHub Actions (cron every 2h)
  pipeline/scrape.py   → liste.cezih.hr  (~370 polite requests)
  pipeline/build.py    → web/public/data/*.json   (compact, static)
  vite build           → web/dist
  wrangler pages deploy → Cloudflare Pages   (static site, free)

Cloudflare Worker  "termin-alerts"  (free tier)
  POST /api/subscribe  · GET /api/confirm · GET /api/unsubscribe
  cron (every 2h, offset +30 min) → reads the published static JSON, checks the D1 subscriptions → emails via Resend/Brevo
  D1 (SQLite) for subscriptions
```

- **Frontend:** Vite + Preact + TypeScript, plain CSS. Mobile-first, base font ≥ 18 px, large tap targets, works on old Android phones, no cookie banner. Analytics: Plausible-style cookieless, or none.
- **The frontend does all the computing** (distances, ranking) on small JSON files, so no server is needed for search.
- **Distance (v1):** straight-line km × 1.3 road factor, ≈ time at 60 km/h. Labelled "≈".
  - Known gap: islands and ferries. v1.1 adds OSRM road distances, precomputed for the ~150 locations × towns above a population threshold, or computed on demand in the Worker.

### Data files (`web/public/data/`)
| File | Content | Size |
|---|---|---|
| `meta.json` | Build time, source timestamps, counts | tiny |
| `procedures.json` | `[id, name, slug, nLocations, searchKeys]` | ~60 KB |
| `locations.json` | Institution locations: name, sub-location, town, lat/lon, county, phone, email, web | ~40 KB |
| `places.json` | Settlements: `[name, lat, lon, countyIdx, pop]`, loaded lazily on screen 2 | ~350 KB raw / ~120 KB gzip |
| `p/{procId}.json` | Per procedure: `[locIdx, days, firstSlot, updated, status]` | ~0.1–3 KB each |

### Location data (the hard part)
- CEZIH gives no addresses. `pipeline/geo/locations.csv` is a **hand-curated** table: `key (institution id + sub-location) → town, lat, lon`.
- It is auto-seeded by matching settlement names, then reviewed by hand.
- Unknown keys are reported by `build.py`, and the CI log warns. These rows still appear in the "Cijela HR" list without a distance.

## 4. Data caveats we surface honestly
- The number shown is **the first free slot in eNaručivanje**, not a guaranteed wait. Users should call to confirm.
- 235 of 365 institutions publish nothing. We show them as "ne objavljuje — nazovi".
- Lists marked "Ustanova nije ažurirala podatke" are stale and get **no** day count.
- The source refreshes every 2 h. We show when *we* last fetched and when the *institution* last updated.

## 5. Legal / privacy
- A disclaimer that this is not medical advice and not an official HZZO service, with HZZO / liste.cezih.hr linked as the source.
- Before going public, a courtesy email to HZZO about reuse and asking for an address dataset.
- GDPR: a privacy page; minimal data; double opt-in; 90-day expiry; deletion on unsubscribe. No health data beyond "subscribed to procedure X" (minimised and explained).
- No cookies, so no banner.

## 6. Build phases
| # | Phase | Done when |
|---|---|---|
| 0 | Research ✅ | `research/FINDINGS.md` |
| 1 | **Data pipeline** | `scrape.py` + `build.py` produce the JSON; the parser handles sub-locations and stale lists |
| 2 | **Locations** | Every location that publishes data has a town and coordinates |
| 3 | **Frontend v1** | Three screens, cards, list, share link, mobile-first |
| 4 | **Alerts** | Worker + D1 + email; subscribe → confirm → notify → unsubscribe works locally |
| 5 | **Deploy** | GitHub repo, Actions cron, Cloudflare Pages + Worker, domain |
| 6 | **Polish & launch** | Synonym tuning, accessibility pass, privacy page, HZZO email, soft launch |

**Later (v1.x / v2):** road distances (OSRM), "can't wait?" private clinics (honest list, clearly labelled), history and trend charts per location, research/analysis pages, a PWA install.

## 7. Accounts needed (owner: you)
GitHub, Cloudflare (Pages + Workers + D1), Resend or Brevo (email), a `.hr` domain.
