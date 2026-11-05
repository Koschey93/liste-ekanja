/**
 * termin-alerts: subscribe / confirm / unsubscribe / renew + a cron that emails matches.
 * Data source for matching = the same static JSON the website uses (SITE_URL/data/...).
 */
import { confirmEmail, expiryEmail, matchEmail, page, type Mail } from './emails'

export interface Env {
  DB: D1Database
  SITE_URL: string
  ALLOWED_ORIGIN: string
  FROM_EMAIL: string
  RESEND_API_KEY?: string
}

export type Sub = {
  token: string; email: string; proc_id: number; proc_name: string; proc_slug: string
  place_name: string; place_slug: string; lat: number; lon: number; radius_km: number; max_days: number
  status: string; created_at: number; confirmed_at: number | null; expires_at: number | null
  reminded_at: number | null; last_sent_at: number | null; last_sent_key: string | null
}
type Row = [number, number | null, string | null, string | null]
type Loc = [string, string, string, number | null, number | null, string, string, string]

const DAY = 86400
const TTL_DAYS = 90
const MAX_ACTIVE_PER_EMAIL = 10
const now = () => Math.floor(Date.now() / 1000)

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const cors = {
      'access-control-allow-origin': env.ALLOWED_ORIGIN,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    }
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
    try {
      if (url.pathname === '/api/subscribe' && req.method === 'POST') return withCors(await subscribe(req, env), cors)
      if (url.pathname === '/api/confirm') return await confirm(url, env)
      if (url.pathname === '/api/unsubscribe') return await unsubscribe(url, env, req.method)
      if (url.pathname === '/api/renew') return await renew(url, env)
      return new Response('Not found', { status: 404 })
    } catch (e) {
      console.error(e)
      return withCors(Response.json({ error: 'server' }, { status: 500 }), cors)
    }
  },

  async scheduled(_ev: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runAlerts(env))
  },
}

function withCors(r: Response, cors: Record<string, string>) {
  for (const [k, v] of Object.entries(cors)) r.headers.set(k, v)
  return r
}

function token(): string {
  const b = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!)
}

// ---------- HTTP handlers ----------

async function subscribe(req: Request, env: Env): Promise<Response> {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const bad = (m: string) => Response.json({ error: m }, { status: 400 })
  if (!b) return bad('json')
  const email = String(b.email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return bad('email')
  const procId = Number(b.procId), lat = Number(b.lat), lon = Number(b.lon)
  const radius = Number(b.radiusKm), maxDays = Number(b.maxDays)
  if (!Number.isInteger(procId) || !(lat > 42 && lat < 47) || !(lon > 13 && lon < 20)) return bad('params')
  if (![0, 25, 50, 100].includes(radius) || !(maxDays >= 1 && maxDays <= 365)) return bad('params')
  const str = (v: unknown, max = 200) => String(v ?? '').slice(0, max)

  const active = await env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE email = ?').bind(email).first<{ n: number }>()
  if ((active?.n ?? 0) >= MAX_ACTIVE_PER_EMAIL) return Response.json({ error: 'limit' }, { status: 429 })

  const sub: Sub = {
    token: token(), email, proc_id: procId, proc_name: str(b.procName), proc_slug: str(b.procSlug, 100),
    place_name: str(b.placeName, 100), place_slug: str(b.placeSlug, 120),
    lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100, // ~1 km precision only
    radius_km: radius, max_days: maxDays, status: 'pending', created_at: now(),
    confirmed_at: null, expires_at: null, reminded_at: null, last_sent_at: null, last_sent_key: null,
  }
  await env.DB.prepare(
    `INSERT INTO subscriptions (token,email,proc_id,proc_name,proc_slug,place_name,place_slug,lat,lon,radius_km,max_days,status,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(sub.token, email, procId, sub.proc_name, sub.proc_slug, sub.place_name, sub.place_slug, sub.lat, sub.lon,
    radius, maxDays, 'pending', sub.created_at).run()
  await send(env, confirmEmail(env, sub))
  return Response.json({ ok: true })
}

async function confirm(url: URL, env: Env): Promise<Response> {
  const t = url.searchParams.get('t') ?? ''
  const sub = await env.DB.prepare('SELECT * FROM subscriptions WHERE token = ?').bind(t).first<Sub>()
  if (!sub) return page('Poveznica nije valjana', 'Ova obavijest ne postoji ili je već obrisana.', env)
  if (sub.status !== 'active') {
    await env.DB.prepare("UPDATE subscriptions SET status='active', confirmed_at=?, expires_at=? WHERE token=?")
      .bind(now(), now() + TTL_DAYS * DAY, t).run()
  }
  return page('✅ Obavijest je uključena',
    `Javit ćemo ti kad se za <b>${esc(sub.proc_name)}</b> pojavi termin unutar <b>${sub.max_days} dana</b>${sub.radius_km ? ` do ${sub.radius_km} km od mjesta ${esc(sub.place_name)}` : ' bilo gdje u Hrvatskoj'}. Obavijest vrijedi ${TTL_DAYS} dana.`,
    env, `${env.SITE_URL}/${sub.proc_slug}/${sub.place_slug}?r=${sub.radius_km}`)
}

async function unsubscribe(url: URL, env: Env, method: string): Promise<Response> {
  const t = url.searchParams.get('t') ?? ''
  // GDPR: unsubscribing deletes the row entirely
  await env.DB.prepare('DELETE FROM subscriptions WHERE token = ?').bind(t).run()
  if (method === 'POST') return new Response('ok') // RFC 8058 one-click from mail clients
  return page('Odjavljen si', 'Obavijest je isključena i tvoji podaci su obrisani.', env)
}

async function renew(url: URL, env: Env): Promise<Response> {
  const t = url.searchParams.get('t') ?? ''
  const r = await env.DB.prepare("UPDATE subscriptions SET expires_at=?, reminded_at=NULL WHERE token=? AND status='active'")
    .bind(now() + TTL_DAYS * DAY, t).run()
  return r.meta.changes
    ? page('🔄 Produljeno', `Obavijest vrijedi još ${TTL_DAYS} dana.`, env)
    : page('Poveznica nije valjana', 'Ova obavijest više ne postoji. Možeš je ponovno uključiti na stranici.', env)
}

// ---------- cron: match & notify ----------

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371, rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export type Match = { locIdx: number; name: string; sub: string; town: string; tel: string; days: number; firstSlot: string; km: number | null }

/** Same rule as the website: earliest slot within radius (road km ≈ straight line × 1.3). */
export function bestMatch(sub: Pick<Sub, 'lat' | 'lon' | 'radius_km' | 'max_days'>, rows: Row[], locs: Loc[]): Match | null {
  let best: Match | null = null
  for (const [li, days, firstSlot] of rows) {
    if (days == null || !firstSlot || days > sub.max_days) continue
    const l = locs[li]
    const km = l[3] != null && l[4] != null ? Math.round(haversineKm(sub.lat, sub.lon, l[3], l[4]) * 1.3) : null
    if (sub.radius_km && (km == null || km > sub.radius_km)) continue
    if (!best || days < best.days || (days === best.days && (km ?? 1e9) < (best.km ?? 1e9))) {
      best = { locIdx: li, name: l[0], sub: l[1], town: l[2], tel: l[5], days, firstSlot, km }
    }
  }
  return best
}

export async function runAlerts(env: Env) {
  const t = now()
  // housekeeping: unconfirmed after 3 days and expired alerts are deleted
  await env.DB.prepare("DELETE FROM subscriptions WHERE (status='pending' AND created_at < ?) OR (expires_at IS NOT NULL AND expires_at < ?)")
    .bind(t - 3 * DAY, t).run()

  const subs = (await env.DB.prepare("SELECT * FROM subscriptions WHERE status='active'").all<Sub>()).results
  if (!subs.length) return { checked: 0, sent: 0 }
  const locs = await fetchJson<Loc[]>(`${env.SITE_URL}/data/locations.json`)
  const rowsCache = new Map<number, Row[] | null>()
  let sent = 0

  for (const sub of subs) {
    // expiry reminder 7 days before
    if (sub.expires_at && !sub.reminded_at && sub.expires_at - t < 7 * DAY) {
      await send(env, expiryEmail(env, sub))
      await env.DB.prepare('UPDATE subscriptions SET reminded_at=? WHERE token=?').bind(t, sub.token).run()
    }
    if (!rowsCache.has(sub.proc_id)) {
      rowsCache.set(sub.proc_id, await fetchJson<Row[]>(`${env.SITE_URL}/data/p/${sub.proc_id}.json`).catch(() => null))
    }
    const rows = rowsCache.get(sub.proc_id)
    if (!rows) continue
    const m = bestMatch(sub, rows, locs)
    if (!m) continue
    const key = `${m.locIdx}|${m.firstSlot}`
    // Claim atomically before sending, so overlapping cron runs can't double-send.
    // Rules: only a new match (different place or slot), and at most ~1 email per day.
    const claim = await env.DB.prepare(
      `UPDATE subscriptions SET last_sent_at=?, last_sent_key=?
       WHERE token=? AND (last_sent_key IS NULL OR last_sent_key <> ?) AND (last_sent_at IS NULL OR last_sent_at < ?)`,
    ).bind(t, key, sub.token, key, t - 20 * 3600).run()
    if (!claim.meta.changes) continue
    try {
      await send(env, matchEmail(env, sub, m))
      sent++
    } catch (e) {
      // roll back the claim so the next run retries
      await env.DB.prepare('UPDATE subscriptions SET last_sent_at=?, last_sent_key=? WHERE token=?')
        .bind(sub.last_sent_at, sub.last_sent_key, sub.token).run()
      console.error('send failed', e)
    }
  }
  console.log(`alerts: checked ${subs.length}, sent ${sent}`)
  return { checked: subs.length, sent }
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cf: { cacheTtl: 300 } } as RequestInit)
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return r.json() as Promise<T>
}

// ---------- email ----------

async function send(env: Env, mail: Mail) {
  if (!env.RESEND_API_KEY) {
    console.log(`[dev email] to=${mail.to} subject="${mail.subject}"\n${mail.text}`)
    return
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.FROM_EMAIL, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text, headers: mail.headers }),
  })
  if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`)
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
