"""Add any location key that appears in the snapshot but not in geo/locations.csv,
with an automatic town guess (checked=0). Hand-review rows with checked=0, then set checked=1.

CSV columns: key, institution, lokacija, town, lat, lon, checked, note
"""
import csv, re
from common import GEO, load_snapshot, load_places, loc_key, norm

CSV = GEO / "locations.csv"
FIELDS = ["key", "institution", "lokacija", "town", "lat", "lon", "checked", "note"]
# words in institution names that point to a town without containing its name
ALIASES = {"kbc": "Zagreb", "kb": "Zagreb", "zagrebacke": "Zagreb", "splitsko": "Split", "osjecko": "Osijek",
           "karlovacke": "Karlovac", "varazdinske": "Varaždin", "sisacko": "Sisak", "bjelovarsko": "Bjelovar",
           "zadarske": "Zadar", "sibensko": "Šibenik", "dubrovacko": "Dubrovnik", "istarski": "Pula",
           "istarske": "Pula", "primorsko": "Rijeka", "licko": "Gospić", "medimurske": "Čakovec",
           "pozesko": "Požega", "vukovarsko": "Vinkovci", "viroviticko": "Virovitica",
           "brodsko": "Slavonski Brod", "koprivnicko": "Koprivnica", "krapinsko": "Krapina", "ozb": None}
STOP = {"dom", "zdravlja", "klinika", "bolnica", "poliklinika", "sveti", "sveta", "nova", "centar", "grad",
        "opca", "dr", "spec", "ord", "dz", "ob", "sb", "zavod", "ivan", "marija", "luka", "vid", "park"}


def main():
    places, _ = load_places()
    by = {}
    for p in places:  # sorted by population desc -> keep largest homonym
        by.setdefault(norm(p[0]), p)
    rows = {}
    if CSV.exists():
        with CSV.open(encoding="utf-8", newline="") as f:
            rows = {r["key"]: r for r in csv.DictReader(f)}
    snap = load_snapshot()
    added = 0
    for inst in snap["institutions"]:
        for r in inst["rows"]:
            k = loc_key(inst["id"], inst["naziv"], r["lokacija"])
            if k in rows:
                continue
            town = guess(inst, r["lokacija"], by)
            p = by.get(norm(town)) if town else None
            rows[k] = {"key": k, "institution": inst["naziv"], "lokacija": r["lokacija"] or "",
                       "town": p[0] if p else "", "lat": p[1] if p else "", "lon": p[2] if p else "",
                       "checked": "0", "note": "auto"}
            added += 1
    with CSV.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, FIELDS)
        w.writeheader()
        for k in sorted(rows, key=lambda k: (rows[k]["institution"], k)):
            w.writerow(rows[k])
    print(f"{added} new keys; {sum(1 for r in rows.values() if not r['lat'])} without coordinates; "
          f"{sum(1 for r in rows.values() if r['checked'] != '1')} unchecked")


def guess(inst, lokacija, by):
    city = (inst["info"].get("Grad") or "").strip()
    if city and norm(city) in by:
        return city
    for text in ([lokacija] if lokacija else []) + [inst["naziv"]]:
        words = [w for w in re.findall(r"[a-z]+", norm(text))]
        for n in (3, 2, 1):
            for i in range(len(words) - n + 1):
                chunk = words[i:i + n]
                if n == 1 and (chunk[0] in STOP or len(chunk[0]) < 4):
                    continue
                w = " ".join(chunk)
                if w in by and by[w][4] > 0:
                    return by[w][0]
        for w in words:
            if ALIASES.get(w):
                return ALIASES[w]
    return None


if __name__ == "__main__":
    main()
