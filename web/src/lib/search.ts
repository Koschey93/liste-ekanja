import type { Place, Procedure } from './data'
import { norm } from './text'

function wordsPrefix(hay: string, token: string): boolean {
  // token must start a word in hay ("kard" matches "kardiologija", not "pedijatrijska kardio..." mid-word)
  return hay.startsWith(token) || hay.includes(' ' + token) || hay.includes('-' + token)
}

export function searchProcedures(all: Procedure[], q: string, limit = 8): Procedure[] {
  const tokens = norm(q).split(' ').filter(Boolean)
  if (!tokens.length) return []
  const scored: [number, Procedure][] = []
  for (const p of all) {
    const name = norm(p.name)
    let score = 0
    let ok = true
    for (const t of tokens) {
      if (wordsPrefix(name, t)) score += name.startsWith(t) ? 30 : 20
      else if (wordsPrefix(p.keys, t)) score += 10
      else if (t.length >= 3 && name.includes(t)) score += 5
      else { ok = false; break }
    }
    if (!ok) continue
    if (/prvi pregled/.test(name)) score += 6
    if (/konzultacija bez pacijenta/.test(name)) score -= 15 // doctor-only consultations: rarely what a patient wants
    if (/za djecu|pedijatr|djecj/.test(name) && !tokens.some((t) => /djec|dijet|pedij/.test(t))) score -= 8
    score += Math.min(p.nLoc, 30) / 3
    score -= name.length / 40
    scored.push([score, p])
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map((s) => s[1])
}

export function searchPlaces(all: Place[], q: string, limit = 7): Place[] {
  const t = norm(q)
  if (t.length < 2) return []
  const starts: Place[] = []
  const contains: Place[] = []
  for (const p of all) { // already sorted by population desc
    const n = norm(p.name)
    if (n.startsWith(t)) starts.push(p)
    else if (t.length >= 3 && n.includes(' ' + t)) contains.push(p)
    if (starts.length >= limit) break
  }
  return [...starts, ...contains].slice(0, limit)
}

/** popular quick picks shown as chips on the first screen */
export const POPULAR: { label: string; q: string }[] = [
  { label: 'Kardiolog', q: 'kardiologija' },
  { label: 'MR', q: 'mr' },
  { label: 'CT', q: 'ct' },
  { label: 'Ultrazvuk', q: 'uzv' },
  { label: 'Kolonoskopija', q: 'kolonoskopija' },
  { label: 'Mamografija', q: 'mamografija' },
  { label: 'Dermatolog', q: 'dermatologija' },
  { label: 'Oftalmolog', q: 'oftalmologija' },
]
