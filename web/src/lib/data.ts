import { norm, slugify } from './text'

export type Procedure = { id: number; name: string; slug: string; nLoc: number; keys: string; hay: string }
export type Location = {
  name: string; sub: string; town: string; lat: number | null; lon: number | null
  tel: string; email: string; web: string
}
export type Place = { name: string; lat: number; lon: number; county: string; pop: number; slug: string }
/** [locIdx, days|null, firstSlot|null, updated|null] */
export type Row = [number, number | null, string | null, string | null]
export type Meta = { built: string; fetched: string; counties: string[]; nProcedures: number; nLocations: number; nRows: number }

const BASE = `${import.meta.env.BASE_URL}data/`
const cache = new Map<string, Promise<unknown>>()

function get<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    cache.set(file, fetch(BASE + file).then((r) => {
      if (!r.ok) throw new Error(`${file}: ${r.status}`)
      return r.json()
    }).catch((e) => { cache.delete(file); throw e }))
  }
  return cache.get(file) as Promise<T>
}

export const loadMeta = () => get<Meta>('meta.json')

export async function loadProcedures(): Promise<Procedure[]> {
  const raw = await get<[number, string, string, number, string][]>('procedures.json')
  return raw.map(([id, name, slug, nLoc, keys]) => ({ id, name, slug, nLoc, keys, hay: `${norm(name)} ${keys}` }))
}

export async function loadLocations(): Promise<Location[]> {
  const raw = await get<[string, string, string, number | null, number | null, string, string, string][]>('locations.json')
  return raw.map(([name, sub, town, lat, lon, tel, email, web]) => ({ name, sub, town, lat, lon, tel, email, web }))
}

let placesP: Promise<Place[]> | null = null
export function loadPlaces(): Promise<Place[]> {
  if (!placesP) {
    placesP = Promise.all([get<[string, number, number, number, number][]>('places.json'), loadMeta()]).then(([raw, meta]) => {
      // a slug must be unique: homonyms get the county appended ("sveti-ivan-zagrebacka")
      const count = new Map<string, number>()
      for (const r of raw) { const s = slugify(r[0]); count.set(s, (count.get(s) ?? 0) + 1) }
      return raw.map(([name, lat, lon, c, pop]) => {
        const county = meta.counties[c]
        const s = slugify(name)
        return { name, lat, lon, county, pop, slug: count.get(s)! > 1 ? `${s}-${slugify(county)}` : s }
      })
    })
  }
  return placesP
}

export const loadRows = (procId: number) => get<Row[]>(`p/${procId}.json`)
