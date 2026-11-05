"""One-off manual review of geo/locations.csv (5 Nov 2026). Re-runnable: applies fixes, marks all reviewed rows checked=1.
town may be "Name|County" to pick the right homonym."""
import csv, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
from common import GEO, load_places, norm

FIX = {
    # wrong automatic guesses / missing
    "321": ("Zagreb", "DB Srebrnjak is in Zagreb"),
    "643|DZ PGŽ - KRK": ("Krk", ""), "643|DZ PGŽ - RAB": ("Rab", ""),
    "1021|DZ SDŽ K.STARI": ("Kaštel Stari", ""),
    "581|DZZC, Kruge 44": ("Zagreb", ""),
    "775": ("Samobor", "DZ ZGŽ headquarters"),
    "775|MOBILNI MAMOGRAF DZ ZGŽ - Gradec": ("Gradec|Zagrebačka", ""),
    "1107": ("Ploče", ""), "601": ("Zagreb", ""), "2202": ("Zagreb", ""), "261": ("Zagreb", "KB Dubrava"),
    "327": ("Zagreb", ""), "287": ("Zagreb", ""), "1261": ("Zagreb", ""), "301": ("Zagreb", ""),
    "325": ("Zagreb", ""), "381": ("Zagreb", "SB Goljak"), "323": ("Zagreb", "PB Sveti Ivan, Jankomir"),
    "1208": ("Zagreb", "Poliklinika za zaštitu djece grada Zagreba"),
    "528": ("Krapinske Toplice", ""), "529": ("Bizovac", ""), "493": ("Daruvar", ""),
    "492": ("Nova Gradiška", "≈ SB Sv. Rafael is in Strmac near Nova Gradiška"),
    "524": ("Makarska", ""), "525": ("Vela Luka", "SB Kalos"), "341": ("Ivanić-Grad", ""), "241": ("Rab", "ŽSB Insula, Banjol"),
    "162": ("Lopača", ""),
    # private practices: town from the phone area code / e-mail (approximate)
    "1461": ("Umag", "≈ from phone 052 84x"), "921": ("Virovitica", ""), "1127": ("Zagreb", ""),
    "1183": ("Zagreb", ""), "852": ("Zagreb", ""), "2161": ("Zagreb", ""),
    "2261": ("Varaždin", "≈ area code 042"), "2582": ("Rijeka", "≈ area code 051"), "1501": ("Osijek", "≈ area code 031"),
    "802": ("Zagreb", ""), "708": ("Zagreb", ""), "732": ("Zagreb", ""), "805": ("Zagreb", ""),
    "727": ("Požega", "≈ area code 034"), "1622": ("Zagreb", ""), "804": ("Metković", "≈ phone 020 69x"),
    "782": ("Split", "≈ area code 021"), "808": ("Krapina", "≈ area code 049"), "2622": ("Karlovac", "≈ area code 047"),
    "2561": ("Požega", "≈ area code 034"), "2702": ("Pula", "≈ from e-mail"), "1041": ("Zagreb", ""),
    "742": ("Poreč", "≈ phone 052 43x"), "810": ("Zagreb", ""),
    # unknown: no contact data at all -> no coordinates, listed without distance
    "825": ("", "unknown"), "713": ("", "unknown"), "784": ("", "unknown"), "2501": ("", "unknown (mobile only)"),
    "1781": ("", "unknown (mobile only)"), "1191": ("", "unknown"), "1188": ("", "unknown"), "1194": ("", "unknown"),
    "1203": ("", "unknown"),
}

places, counties = load_places()
by_name, by_name_county = {}, {}
for p in places:
    by_name.setdefault(norm(p[0]), p)
    by_name_county.setdefault((norm(p[0]), counties[p[3]]), p)

path = GEO / "locations.csv"
rows = list(csv.DictReader(path.open(encoding="utf-8", newline="")))
for r in rows:
    if r["key"] in FIX:
        town, note = FIX[r["key"]]
        if town:
            name, _, county = town.partition("|")
            p = by_name_county.get((norm(name), county)) if county else by_name.get(norm(name))
            if not p:
                sys.exit(f"place not found: {town}")
            r.update(town=p[0], lat=p[1], lon=p[2], note=note or "manual")
        else:
            r.update(town="", lat="", lon="", note=note)
    r["checked"] = "1"
with path.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, rows[0].keys())
    w.writeheader()
    w.writerows(rows)
print(len(rows), "rows reviewed;", sum(1 for r in rows if not r["lat"]), "without coordinates")
