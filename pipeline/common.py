import json, pathlib, re, unicodedata

ROOT = pathlib.Path(__file__).parent
GEO = ROOT / "geo"


def norm(s: str) -> str:
    s = s.replace("đ", "dj").replace("Đ", "Dj")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9/ ]+", " ", s)).strip()


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", norm(s)).strip("-")[:80]


def loc_key(inst_id: int, inst_name: str, lokacija):
    """One physical place = institution, or institution + named sub-location."""
    if lokacija and norm(lokacija) != norm(inst_name):
        return f"{inst_id}|{lokacija.strip()}"
    return str(inst_id)


def load_snapshot():
    return json.loads((ROOT / "out/snapshot.json").read_text(encoding="utf-8"))


def load_places():
    return json.loads((GEO / "places.json").read_text(encoding="utf-8")), \
        json.loads((GEO / "counties.json").read_text(encoding="utf-8"))
