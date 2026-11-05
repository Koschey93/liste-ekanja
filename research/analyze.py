"""Summarise the snapshot and try to place each institution on the map using only offline data
(address/postal/city fields from CEZIH, else a settlement name found inside the institution name)."""
import json, re, pathlib, collections, unicodedata
D = pathlib.Path(__file__).parent / "data"
snap = json.loads((D / "snapshot_by_institution.json").read_text(encoding="utf-8"))
sett = json.loads((D / "settlements.json").read_text(encoding="utf-8"))  # sorted by population desc


def norm(s):
    return unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()


by_name = {}
for s in sett:
    by_name.setdefault(norm(s["naziv"]), s)  # keep most populous of duplicates
# adjective forms frequently used in institution names
ALIASES = {"zagrebacka": "zagreb", "splitsko": "split", "osjecko": "osijek", "karlovacke": "karlovac",
           "varazdinske": "varazdin", "sisacko": "sisak", "bjelovarsko": "bjelovar", "zadarske": "zadar",
           "sibensko": "sibenik", "dubrovacko": "dubrovnik", "istarske": "pula", "pulska": "pula",
           "primorsko": "rijeka", "licko": "gospic", "medimurske": "cakovec", "pozesko": "pozega",
           "vukovarsko": "vukovar", "viroviticko": "virovitica", "brodsko": "slavonski brod",
           "koprivnicko": "koprivnica", "krapinsko": "krapina", "kbc": "zagreb", "kb": "zagreb"}


def locate(rec):
    info = rec["info"]
    city = (info.get("Grad") or "").strip()
    if city and norm(city) in by_name:
        return by_name[norm(city)], "grad"
    name = norm(rec["naziv"])
    words = re.findall(r"[a-z]+", name)
    # try bigrams first (e.g. "slavonski brod", "krapinske toplice") then single words
    for n in (3, 2, 1):
        for i in range(len(words) - n + 1):
            w = " ".join(words[i:i + n])
            if len(w) > 3 and w in by_name and by_name[w]["pop"] > 0:
                return by_name[w], "naziv"
    for w in words:
        if w in ALIASES:
            return by_name[ALIASES[w]], "alias"
    return None, None


rows = [(r, l) for r in snap for l in r["liste"]]
with_lists = [r for r in snap if r["liste"]]
placed = collections.Counter()
inst_geo = []
for r in snap:
    s, how = locate(r)
    placed[how] += 1
    inst_geo.append({"id": r["id"], "naziv": r["naziv"], "grad": r["info"].get("Grad"),
                     "adresa": r["info"].get("Adresa"), "telefon": r["info"].get("Telefon"),
                     "web": r["info"].get("Web"), "email": r["info"].get("E-mail"),
                     "n_lista": len(r["liste"]),
                     "lat": s and s["lat"], "lon": s and s["lon"], "regId": s and s["regId"],
                     "mjesto_guess": s and s["naziv"], "geo_method": how})
(D / "institutions_geo.json").write_text(json.dumps(inst_geo, ensure_ascii=False, indent=1), encoding="utf-8")

days = [l["dani_cekanja"] for _, l in rows if l["dani_cekanja"] is not None]
days.sort()
print("institutions:", len(snap), "| with published lists:", len(with_lists))
print("list rows:", len(rows), "| distinct procedures with data:", len({l["postupak"] for _, l in rows}))
print("address filled:", sum(1 for r in snap if r["info"].get("Adresa")), "| city filled:",
      sum(1 for r in snap if r["info"].get("Grad")))
print("geo placement:", dict(placed), "| placed among those WITH lists:",
      sum(1 for g in inst_geo if g["n_lista"] and g["lat"]), "/", len(with_lists))
print("wait days median:", days[len(days) // 2], "p90:", days[int(len(days) * .9)], "max:", days[-1])
print("unplaced with lists:", [g["naziv"] for g in inst_geo if g["n_lista"] and not g["lat"]][:40])
