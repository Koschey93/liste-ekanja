/** Same normalisation as pipeline/common.py norm(): lowercase, no diacritics, đ -> dj. */
export function norm(s: string): string {
  return s
    .replace(/đ/g, 'dj')
    .replace(/Đ/g, 'Dj')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function slugify(s: string): string {
  return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

const MONTHS = ['sij', 'velj', 'ožu', 'tra', 'svi', 'lip', 'srp', 'kol', 'ruj', 'lis', 'stu', 'pro']
const DAYS = ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub']

/** "2026-11-26T09:15" -> "čet, 26. stu 2026." */
export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}.`
}

/** Croatian plural for "dan": 1 dan, 2 dana, 5 dana, 21 dan */
export function dana(n: number): string {
  const m10 = n % 10, m100 = n % 100
  return m10 === 1 && m100 !== 11 ? 'dan' : 'dana'
}

/** 1 ustanova, 2–4 ustanove, 5+ ustanova (12–14 ustanova) */
export function ustanova(n: number): string {
  const m10 = n % 10, m100 = n % 100
  return m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14) ? 'ustanove' : 'ustanova'
}

export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return 'nepoznato'
  const h = Math.round((now - new Date(iso).getTime()) / 3.6e6)
  if (h < 1) return 'prije manje od sat'
  if (h < 24) return `prije ${h} h`
  const d = Math.round(h / 24)
  return `prije ${d} ${dana(d)}`
}
