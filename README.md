# Termin blizu

Find where in Croatia you can get a referred exam soonest: **what you need → where you live → nearest / earliest nearby / earliest anywhere**, plus email alerts.
Data: [liste.cezih.hr](https://liste.cezih.hr) (HZZO), refreshed every 2 h. See [PLAN.md](PLAN.md) for product decisions and [research/FINDINGS.md](research/FINDINGS.md) for the background research.

```
pipeline/   Python: scrape liste.cezih.hr → build compact JSON into web/public/data
  scrape.py            full snapshot (~370 requests, ~6 min) → pipeline/out/snapshot.json
  build.py             snapshot + geo + synonyms → web/public/data/*.json
  seed_locations.py    adds new institution locations to geo/locations.csv with a town guess (checked=0)
  geo/locations.csv    HAND-CURATED institution → town + coordinates (CEZIH has no addresses)
  geo/places.json      10,860 Croatian settlements (GeoNames, CC-BY 4.0)
  synonyms.json        everyday words → procedure names ("magnet" → MR, "srce" → kardiologija)
web/        Vite + Preact + TS static site (all ranking happens in the browser)
worker/     Cloudflare Worker + D1: alert subscribe/confirm/unsubscribe/renew + 2-hourly matching cron
.github/workflows/update.yml   cron: scrape → build → deploy to Cloudflare Pages
```

## Run locally
Requirements: Python 3.11+, Node 20+.

```bash
python pipeline/scrape.py
```
```bash
python pipeline/build.py
```
```bash
npm install --prefix web && npm run dev --prefix web
```
Open http://localhost:5173.

Alerts (optional, in a second terminal). Without `RESEND_API_KEY`, emails are printed to the console instead of being sent.
```bash
npm install --prefix worker && npm run db:local --prefix worker && npm run dev --prefix worker -- --port 8790
```
To trigger the alert cron by hand, open `http://localhost:8790/__scheduled`.

## When CEZIH adds a new institution
`build.py` prints `WARNING: N locations without coordinates`, and CI shows the same warning. Then:
1. Run `python pipeline/seed_locations.py`. It appends the new keys with a town guess.
2. Open `pipeline/geo/locations.csv` and fix the `town`/`lat`/`lon` of rows with `checked=0`. Set them to `1` and commit.

Until then, those places still appear in the full list, without a distance.

## Deploy (one-time setup)
1. **GitHub**: push this repo. In *Settings → Secrets*, add `CLOUDFLARE_API_TOKEN` (Pages + Workers + D1 edit) and `CLOUDFLARE_ACCOUNT_ID`.
2. **Cloudflare Pages**: create a project named `termin-blizu` (direct upload). The workflow deploys `web/dist` on every run. Unknown paths fall back to `index.html` (SPA), so shareable links like `/mr-koljena/split?r=50` work.
3. **Database**:
   ```bash
   npx --prefix worker wrangler d1 create termin-alerts
   ```
   Put the printed id into `worker/wrangler.toml`, then:
   ```bash
   npm run db:remote --prefix worker
   ```
4. **Email**: create a Resend (or Brevo) account and verify the sending domain. Then:
   ```bash
   npx --prefix worker wrangler secret put RESEND_API_KEY
   ```
5. **Worker**: set `SITE_URL`, `ALLOWED_ORIGIN` and `FROM_EMAIL` in `worker/wrangler.toml`. Add a route `your-domain.hr/api/*` so the API is same-origin with the site. Then:
   ```bash
   npm run deploy --prefix worker
   ```
6. **Domain**: attach the custom domain to the Pages project.

The Worker cron runs at :40 every 2 h, after the data deploy, and reads the published `/data/*.json`.

Note: GitHub pauses scheduled workflows in repositories with no activity for 60 days, so push something occasionally.

## Data caveats (shown to users too)
- The "days" figure is the first free slot in eNaručivanje, not a guaranteed wait.
- Institutions marked "Ustanova nije ažurirala podatke" get no day count.
- Distance is straight line × 1.3 from the centre of the settlement. Islands and ferries are underestimated (OSRM is planned).
