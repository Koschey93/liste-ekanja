"""geo/raw/geonames_HR.txt (GeoNames, CC-BY 4.0) -> geo/places.json
[[name, lat, lon, countyIdx, population], ...] sorted by population desc; COUNTIES list in counties.json"""
import json, pathlib
H = pathlib.Path(__file__).parent
# GeoNames admin1 code -> official county name
ADM = {"01":"Bjelovarsko-bilogorska","02":"Brodsko-posavska","03":"Dubrovačko-neretvanska","04":"Istarska",
 "05":"Karlovačka","06":"Koprivničko-križevačka","07":"Krapinsko-zagorska","08":"Ličko-senjska","09":"Međimurska",
 "10":"Osječko-baranjska","11":"Požeško-slavonska","12":"Primorsko-goranska","13":"Šibensko-kninska",
 "14":"Sisačko-moslavačka","15":"Splitsko-dalmatinska","16":"Varaždinska","17":"Virovitičko-podravska",
 "18":"Vukovarsko-srijemska","19":"Zadarska","20":"Zagrebačka","21":"Grad Zagreb"}
codes = sorted(ADM)
counties = [ADM[c] for c in codes]
rows, seen = [], set()
for line in (H / "raw/geonames_HR.txt").read_text(encoding="utf-8").splitlines():
    f = line.split("\t")
    if f[6] != "P" or f[10] not in ADM:
        continue
    key = (f[1], f[10])
    if key in seen:  # same name twice in one county: keep first (usually the main one)
        continue
    seen.add(key)
    rows.append([f[1], round(float(f[4]), 4), round(float(f[5]), 4), codes.index(f[10]), int(f[14] or 0)])
rows.sort(key=lambda r: -r[4])
(H / "places.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
(H / "counties.json").write_text(json.dumps(counties, ensure_ascii=False), encoding="utf-8")
print(len(rows), "places,", (H / "places.json").stat().st_size // 1024, "KB")
