import type { Location, Place, Row } from './data'

export const RADII = [25, 50, 100, 0] as const // 0 = cijela Hrvatska
export const ROAD_FACTOR = 1.3
const AVG_KMH = 65

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371, rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export type Option = {
  loc: Location
  locIdx: number
  days: number | null // null = stale / no free slot published
  firstSlot: string | null
  updated: string | null
  km: number | null // estimated road km, null = location unknown
  minutes: number | null
}

export type Ranking = {
  all: Option[]
  nearest: Option | null
  bestInRadius: Option | null
  bestOverall: Option | null
  stale: Option[] // listed but institution hasn't updated → "nazovi"
}

export function rank(rows: Row[], locs: Location[], here: Place, radiusKm: number): Ranking {
  const all: Option[] = rows.map(([li, days, firstSlot, updated]) => {
    const loc = locs[li]
    const km = loc.lat != null && loc.lon != null
      ? Math.round(haversineKm(here.lat, here.lon, loc.lat, loc.lon) * ROAD_FACTOR)
      : null
    return { loc, locIdx: li, days, firstSlot, updated, km, minutes: km == null ? null : Math.round((km / AVG_KMH) * 60) + 5 }
  })
  const live = all.filter((o) => o.days != null)
  const placed = live.filter((o) => o.km != null)
  const byDays = (a: Option, b: Option) => a.days! - b.days! || (a.km ?? 1e9) - (b.km ?? 1e9)
  const nearest = [...placed].sort((a, b) => a.km! - b.km! || a.days! - b.days!)[0] ?? null
  const inRadius = radiusKm ? placed.filter((o) => o.km! <= radiusKm) : live
  const bestInRadius = [...inRadius].sort(byDays)[0] ?? null
  const bestOverall = [...live].sort(byDays)[0] ?? null
  const stale = all
    .filter((o) => o.days == null && o.km != null && (!radiusKm || o.km <= radiusKm))
    .sort((a, b) => a.km! - b.km!)
  return { all, nearest, bestInRadius, bestOverall, stale }
}

export function fmtTravel(o: Option): string {
  if (o.km == null) return 'udaljenost nepoznata'
  if (o.km <= 3) return 'u tvom mjestu'
  const m = o.minutes!
  const t = m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 >= 10 ? ` ${m % 60} min` : ''}`
  return `≈ ${o.km} km · ${t}`
}

export function nearestPlace(places: Place[], lat: number, lon: number): Place {
  let best = places[0], bestD = Infinity
  for (const p of places) {
    // prefer real settlements (pop>0) unless an unpopulated one is much closer
    const d = haversineKm(lat, lon, p.lat, p.lon) + (p.pop > 0 ? 0 : 1.5)
    if (d < bestD) { bestD = d; best = p }
  }
  return best
}
