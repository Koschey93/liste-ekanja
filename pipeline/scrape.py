"""Fetch a full snapshot of liste.cezih.hr.

Output: pipeline/out/snapshot.json
  {fetched_at, procedures:[{Id,Naziv}], institutions:[{id,naziv,info,rows:[...]}]}
Each row: {lokacija|None, postupak, slots:[iso], dani|None, azurirano|None, stale:bool}

Usage: python scrape.py [--delay 0.5] [--only 1961,1111]
"""
import argparse, datetime as dt, html, json, pathlib, re, sys, time, urllib.request

BASE = "https://liste.cezih.hr"
OUT = pathlib.Path(__file__).parent / "out"
UA = {"User-Agent": "TerminBlizu/0.1 (non-commercial public-interest tool; snapshot every 2h)"}


def get(path, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(BASE + path, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8-sig")
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(5 * (i + 1))


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def to_iso(s):  # "26.11.2026. 09:15" -> "2026-11-26T09:15"
    d = dt.datetime.strptime(s.strip(), "%d.%m.%Y. %H:%M")
    return d.strftime("%Y-%m-%dT%H:%M")


def to_iso_sec(s):  # "05.11.2026. 12:01:37"
    try:
        return dt.datetime.strptime(s.strip(), "%d.%m.%Y. %H:%M:%S").strftime("%Y-%m-%dT%H:%M:%S")
    except ValueError:
        return None


HEADER = re.compile(r'class="col-md-12 slotHeader">\s*(.*?)\s*</div>', re.S)
SLOT = re.compile(r"<div>(\d\d\.\d\d\.\d{4}\. \d\d:\d\d)</div>")
DAYS = re.compile(r'Broj dana čekanja\s*</div>\s*<div class="row slotEdited">\s*(-?\d+)')
UPD = re.compile(r'ažuriranja liste\s*</div>\s*<div class="row slotEdited">\s*(.*?)\s*</div>', re.S)


def parse_ustanova(page):
    info = {}
    m = re.search(r'id="ustanovaInfo">(.*?)</div></div>', page, re.S)
    if m:
        for k, v in re.findall(r"<span>([^<]+):</span>(.*?)</div>", m.group(1) + "</div>", re.S):
            v = clean(v)
            info[k.strip()] = "" if v == "-" else v
    rows = []
    for block in page.split("col-md-10 col-md-offset-1 well")[1:]:
        heads = [clean(h) for h in HEADER.findall(block)]
        if not heads:
            continue
        lok, post = (heads[0], heads[1]) if len(heads) >= 2 else (None, heads[0])
        days = DAYS.search(block)
        upd = UPD.search(block)
        upd_txt = clean(upd.group(1)) if upd else ""
        stale = "nije ažurirala" in upd_txt.lower()
        rows.append({
            "lokacija": lok,
            "postupak": post,
            "slots": [to_iso(s) for s in SLOT.findall(block)],
            "dani": int(days.group(1)) if days else None,
            "azurirano": None if stale else to_iso_sec(upd_txt),
            "stale": stale,
        })
    return info, rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--delay", type=float, default=0.5)
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    started = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    procs = json.loads(get("/Home/DohvatZahvata?query="))
    insts = json.loads(get("/Home/DohvatUstanova?query="))
    if a.only:
        keep = {int(x) for x in a.only.split(",")}
        insts = [u for u in insts if u["Id"] in keep]
    print(f"{len(procs)} procedures, {len(insts)} institutions", flush=True)
    result, errors = [], 0
    for i, u in enumerate(insts):
        try:
            info, rows = parse_ustanova(get(f"/Ustanova?uId={u['Id']}"))
        except Exception as e:  # keep going; one bad page must not kill the run
            errors += 1
            info, rows = {"error": str(e)}, []
        result.append({"id": u["Id"], "naziv": u["Naziv"].strip(), "info": info, "rows": rows})
        if i % 50 == 0:
            print(f"  {i}/{len(insts)} {u['Naziv'].strip()} ({len(rows)})", flush=True)
        time.sleep(a.delay)
    snap = {"fetched_at": started, "procedures": procs, "institutions": result}
    (OUT / "snapshot.json").write_text(json.dumps(snap, ensure_ascii=False), encoding="utf-8")
    n = sum(len(r["rows"]) for r in result)
    print(f"done: {n} rows, {errors} errors", flush=True)
    # fail the CI run if the source looks broken (markup change, outage)
    if not a.only and (n < 3000 or errors > len(insts) * 0.2):
        print("ERROR: snapshot looks incomplete", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
