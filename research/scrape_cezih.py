"""Snapshot scraper for liste.cezih.hr (HZZO waiting lists).

Pulls:
  - procedures  (/Home/DohvatZahvata)
  - institutions (/Home/DohvatUstanova)
  - regions     (/Home/DohvatRegija)
  - per-institution page (/Ustanova?uId=) -> address/contact + every procedure with
    first free slots, days waiting, last update
Writes JSON to research/data/. Rate-limited (~1 req/s) to be polite.
"""
import json, re, sys, time, html, pathlib, urllib.request

BASE = "https://liste.cezih.hr"
OUT = pathlib.Path(__file__).parent / "data"
OUT.mkdir(exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (research snapshot; liste-cekanja prototype)"}


def get(path, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(BASE + path, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8-sig")
        except Exception as e:
            if i == tries - 1:
                raise
            time.sleep(3 * (i + 1))


def clean(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def parse_ustanova(page):
    info = {}
    m = re.search(r'id="ustanovaInfo">(.*?)</div></div>', page, re.S)
    if m:
        for k, v in re.findall(r"<span>([^<]+):</span>(.*?)</div>", m.group(1) + "</div>", re.S):
            info[k.strip()] = clean(v)
    items = []
    for block in page.split('col-md-10 col-md-offset-1 well')[1:]:
        name = re.search(r'col-md-12 slotHeader">\s*(.*?)\s*</div>', block, re.S)
        rows = re.findall(r'<div class="row slotEdited">(.*?)</div>\s*(?=<div class="row slotEdited">|</div>)', block, re.S)
        slots = re.findall(r"<div>(\d\d\.\d\d\.\d{4}\. \d\d:\d\d)</div>", block)
        days = re.search(r"Broj dana čekanja\s*</div>\s*<div class=\"row slotEdited\">\s*(-?\d+)", block)
        upd = re.search(r"ažuriranja liste\s*</div>\s*<div class=\"row slotEdited\">\s*([\d.: ]+)", block)
        if name:
            items.append({
                "postupak": clean(name.group(1)),
                "slots": slots,
                "dani_cekanja": int(days.group(1)) if days else None,
                "azurirano": upd.group(1).strip() if upd else None,
            })
    return info, items


def main():
    procs = json.loads(get("/Home/DohvatZahvata?query="))
    insts = json.loads(get("/Home/DohvatUstanova?query="))
    regs = json.loads(get("/Home/DohvatRegija?query="))
    for n, d in [("procedures", procs), ("institutions", insts), ("regions", regs)]:
        (OUT / f"{n}.json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(procs), "procedures", len(insts), "institutions", len(regs), "regions", flush=True)

    result = []
    for i, u in enumerate(insts):
        try:
            info, items = parse_ustanova(get(f"/Ustanova?uId={u['Id']}"))
        except Exception as e:
            info, items = {"error": str(e)}, []
        result.append({"id": u["Id"], "naziv": u["Naziv"], "info": info, "liste": items})
        if i % 25 == 0:
            print(i, u["Naziv"], len(items), flush=True)
        time.sleep(1)
    (OUT / "snapshot_by_institution.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    print("done", sum(len(r["liste"]) for r in result), "rows", flush=True)


if __name__ == "__main__":
    main()
