import { esc, type Env, type Match, type Sub } from './index'

export type Mail = { to: string; subject: string; html: string; text: string; headers?: Record<string, string> }

const api = (env: Env) => env.SITE_URL.replace(/\/$/, '') // API is served under the same origin (/api/*)
const MONTHS = ['siječnja', 'veljače', 'ožujka', 'travnja', 'svibnja', 'lipnja', 'srpnja', 'kolovoza', 'rujna', 'listopada', 'studenoga', 'prosinca']
const fmt = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}.` }
const where = (s: Sub) => (s.radius_km ? `do ${s.radius_km} km od mjesta ${s.place_name}` : 'bilo gdje u Hrvatskoj')

function layout(body: string, unsub: string) {
  return `<!doctype html><html lang="hr"><body style="margin:0;background:#f7f5f0;font-family:Arial,Helvetica,sans-serif;color:#1d2320">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<p style="font-weight:bold;color:#0f6b5c;font-size:18px;margin:0 0 16px">Termin blizu</p>
<div style="background:#fff;border-radius:14px;padding:20px;font-size:17px;line-height:1.5">${body}</div>
<p style="color:#5b6460;font-size:13px;line-height:1.5;margin-top:16px">Podaci: liste.cezih.hr (HZZO). Termin blizu nije službena stranica HZZO-a.<br>
<a href="${unsub}" style="color:#5b6460">Odjavi ovu obavijest</a> (podaci se brišu odmah).</p>
</div></body></html>`
}
const btn = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${href}" style="background:#0f6b5c;color:#fff;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block">${label}</a></p>`

function unsubHeaders(unsub: string) {
  return { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
}

export function confirmEmail(env: Env, s: Sub): Mail {
  const link = `${api(env)}/api/confirm?t=${s.token}`
  const unsub = `${api(env)}/api/unsubscribe?t=${s.token}`
  return {
    to: s.email,
    subject: 'Potvrdi obavijest o terminu',
    html: layout(`<p>Zatražio/la si obavijest kad se za <b>${esc(s.proc_name)}</b> pojavi termin unutar <b>${s.max_days} dana</b> ${esc(where(s))}.</p>
${btn(link, 'Potvrdi obavijest')}
<p style="color:#5b6460;font-size:14px">Ako ovo nisi ti, zanemari poruku — bez potvrde ništa ne šaljemo, a zahtjev se briše za 3 dana.</p>`, unsub),
    text: `Potvrdi obavijest za ${s.proc_name} (${s.max_days} dana, ${where(s)}): ${link}\nAko ovo nisi ti, zanemari poruku.`,
    headers: unsubHeaders(unsub),
  }
}

export function matchEmail(env: Env, s: Sub, m: Match): Mail {
  const unsub = `${api(env)}/api/unsubscribe?t=${s.token}`
  const results = `${env.SITE_URL}/${s.proc_slug}/${s.place_slug}?r=${s.radius_km}`
  const inst = m.sub ? `${m.name} — ${m.sub}` : m.name
  const dist = m.km != null ? ` (≈ ${m.km} km)` : ''
  return {
    to: s.email,
    subject: `Termin za ${m.days} dana: ${s.proc_name} — ${m.town || inst}`,
    html: layout(`<p>Pojavio se termin koji odgovara tvojoj obavijesti:</p>
<p style="font-size:20px;margin:12px 0"><b>${esc(s.proc_name)}</b></p>
<p><b>${esc(inst)}</b>${m.town ? `, ${esc(m.town)}` : ''}${dist}<br>
Prvi slobodni termin: <b>${fmt(m.firstSlot)}</b> — za <b>${m.days} dana</b></p>
${m.tel ? `<p>Telefon: <a href="tel:${m.tel.replace(/[^\d+]/g, '')}">${esc(m.tel)}</a></p>` : ''}
${btn(results, 'Pogledaj sve termine')}
<p style="color:#5b6460;font-size:14px">Termini se brzo popunjavaju — nazovi ustanovu ili zamoli liječnika obiteljske medicine da te naruči kroz eNaručivanje.</p>`, unsub),
    text: `${s.proc_name}: ${inst}${m.town ? ', ' + m.town : ''}${dist} — prvi slobodni termin ${fmt(m.firstSlot)} (za ${m.days} dana).${m.tel ? ' Tel: ' + m.tel : ''}\nSvi termini: ${results}\nOdjava: ${unsub}`,
    headers: unsubHeaders(unsub),
  }
}

export function expiryEmail(env: Env, s: Sub): Mail {
  const unsub = `${api(env)}/api/unsubscribe?t=${s.token}`
  const renew = `${api(env)}/api/renew?t=${s.token}`
  return {
    to: s.email,
    subject: `Obavijest za ${s.proc_name} uskoro istječe`,
    html: layout(`<p>Tvoja obavijest za <b>${esc(s.proc_name)}</b> (${esc(where(s))}) istječe za 7 dana.</p>
${btn(renew, 'Produlji za 90 dana')}<p style="color:#5b6460;font-size:14px">Ako više ne trebaš obavijest, ne moraš ništa — sama će se obrisati.</p>`, unsub),
    text: `Obavijest za ${s.proc_name} istječe za 7 dana. Produlji: ${renew}`,
    headers: unsubHeaders(unsub),
  }
}

/** Small HTML page for confirm / unsubscribe / renew landings. */
export function page(title: string, body: string, env: Env, cta?: string): Response {
  const html = `<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title.replace(/[^\p{L}\p{N} ]/gu, '').trim())} — Termin blizu</title>
<style>body{margin:0;background:#f7f5f0;color:#1d2320;font:18px/1.5 system-ui,sans-serif}main{max-width:560px;margin:10vh auto;padding:0 16px}
.c{background:#fff;border-radius:14px;padding:24px}a.b{display:inline-block;margin-top:16px;background:#0f6b5c;color:#fff;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold}
@media(prefers-color-scheme:dark){body{background:#121614;color:#ecefed}.c{background:#1b211e}}</style></head>
<body><main><div class="c"><h1 style="font-size:1.5rem;margin-top:0">${esc(title)}</h1><p>${body}</p>
<a class="b" href="${cta ?? env.SITE_URL}">${cta ? 'Pogledaj termine' : 'Na početnu'}</a></div></main></body></html>`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
