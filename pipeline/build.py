"""out/snapshot.json + geo/* + synonyms.json -> web/public/data/*.json (compact, static).

procedures.json : [[id, name, slug, nLoc, keys], ...]      (only procedures with >=1 location)
locations.json  : [[name, sub, town, lat|null, lon|null, tel, email, web], ...]
places.json     : [[name, lat, lon, countyIdx, pop], ...]   (+ counties in meta.json)
p/{id}.json     : [[locIdx, days|null, firstSlotISO|null, updatedISO|null], ...]  days=null -> stale/no slot
meta.json       : {built, fetched, counties, nProcedures, nLocations, nRows}
"""
import csv, datetime as dt, json, pathlib, shutil, sys
from common import GEO, ROOT, load_places, load_snapshot, loc_key, norm, slugify

OUT = ROOT.parent / "web/public/data"


def dump(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main():
    snap = load_snapshot()
    places, counties = load_places()
    syn = json.loads((ROOT / "synonyms.json").read_text(encoding="utf-8"))["entries"]
    geo = {}
    with (GEO / "locations.csv").open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            geo[r["key"]] = r

    # CEZIH procedure ids by normalized name (first wins for the 3 duplicate names)
    pid = {}
    for p in snap["procedures"]:
        pid.setdefault(norm(p["Naziv"]), (p["Id"], p["Naziv"].strip()))
    next_synthetic = -1

    locs, loc_idx = [], {}
    per_proc = {}  # id -> {locIdx: row}
    unknown_geo = set()
    for inst in snap["institutions"]:
        info = inst["info"]
        for r in inst["rows"]:
            k = loc_key(inst["id"], inst["naziv"], r["lokacija"])
            if k not in loc_idx:
                g = geo.get(k, {})
                if not g.get("lat"):
                    unknown_geo.add(f"{k}  {inst['naziv']}")
                sub = k.split("|", 1)[1] if "|" in k else ""
                loc_idx[k] = len(locs)
                locs.append([inst["naziv"], sub, g.get("town") or "",
                             float(g["lat"]) if g.get("lat") else None,
                             float(g["lon"]) if g.get("lon") else None,
                             info.get("Telefon", ""), info.get("E-mail", ""), info.get("Web", "")])
            n = norm(r["postupak"])
            if n not in pid:
                pid[n] = (next_synthetic, r["postupak"].strip())
                next_synthetic -= 1
            proc_id = pid[n][0]
            li = loc_idx[k]
            row = [li, None if r["stale"] else r["dani"],
                   None if r["stale"] or not r["slots"] else r["slots"][0], r["azurirano"]]
            cur = per_proc.setdefault(proc_id, {}).get(li)
            # same place listed twice for one procedure: keep the earlier slot
            if cur is None or (row[1] is not None and (cur[1] is None or row[1] < cur[1])):
                per_proc[proc_id][li] = row

    names = {v[0]: v[1] for v in pid.values()}
    procedures, slugs = [], set()
    for proc_id, rows in per_proc.items():
        name = names[proc_id]
        slug = slugify(name)
        if slug in slugs:
            slug = f"{slug}-{abs(proc_id)}"
        slugs.add(slug)
        n = norm(name)
        keys = sorted({w for words, subs in syn for w in words if any(s in n for s in subs)})
        procedures.append([proc_id, name, slug, len(rows), " ".join(keys)])
    procedures.sort(key=lambda p: p[1].lower())

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "p").mkdir(parents=True)
    for proc_id, rows in per_proc.items():
        dump(OUT / f"p/{proc_id}.json", sorted(rows.values(), key=lambda r: (r[1] is None, r[1] or 0)))
    dump(OUT / "procedures.json", procedures)
    dump(OUT / "locations.json", locs)
    dump(OUT / "places.json", places)
    n_rows = sum(len(v) for v in per_proc.values())
    dump(OUT / "meta.json", {
        "built": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "fetched": snap["fetched_at"], "counties": counties,
        "nProcedures": len(procedures), "nLocations": len(locs), "nRows": n_rows})
    print(f"{len(procedures)} procedures, {len(locs)} locations, {n_rows} rows -> {OUT}")
    if unknown_geo:
        print(f"WARNING: {len(unknown_geo)} locations without coordinates (run seed_locations.py, then review):")
        for u in sorted(unknown_geo)[:60]:
            print("   ", u)
    return 0


if __name__ == "__main__":
    sys.exit(main())
