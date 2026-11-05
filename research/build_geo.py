"""Build data/settlements.json: every Croatian populated place -> lat/lon, county, CEZIH regId."""
import json, pathlib
D = pathlib.Path(__file__).parent / "data"
# GeoNames admin1 -> CEZIH regId (CEZIH merges Grad Zagreb + Zagrebačka into "114")
A2R = {"01":"004","02":"080","03":"018","04":"065","05":"034","06":"037","07":"040","08":"026",
       "09":"010","10":"060","11":"079","12":"072","13":"083","14":"078","15":"082","16":"088",
       "17":"091","18":"090","19":"100","20":"114","21":"114"}
regs = {r["Id"]: r["Naziv"] for r in json.loads((D/"regions.json").read_text(encoding="utf-8"))}
out = []
for line in (D/"geo_raw/HR.txt").read_text(encoding="utf-8").splitlines():
    f = line.split("\t")
    if f[6] != "P" or f[10] not in A2R:
        continue
    rid = A2R[f[10]]
    out.append({"naziv": f[1], "lat": float(f[4]), "lon": float(f[5]), "pop": int(f[14] or 0),
                "regId": rid, "zupanija": regs[rid]})
out.sort(key=lambda x: -x["pop"])
(D/"settlements.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
print(len(out), "settlements;", out[:3])
