import { useEffect, useState } from 'preact/hooks'
import { loadLocations, loadRows, type Location, type Place, type Procedure, type Row } from '../lib/data'
import { fmtTravel, RADII, rank, type Option, type Ranking } from '../lib/rank'
import { go } from '../lib/router'
import { ago, dana, fmtDate, ustanova } from '../lib/text'
import { AlertForm } from './AlertForm'

export function Results({ proc, place, radius }: { proc: Procedure; place: Place; radius: number }) {
  const [data, setData] = useState<{ rows: Row[]; locs: Location[] } | null>(null)
  const [err, setErr] = useState(false)
  const [sort, setSort] = useState<'km' | 'days'>('km')
  const [showAll, setShowAll] = useState(false)
  const [sheet, setSheet] = useState<Option | null>(null)

  useEffect(() => {
    setData(null)
    Promise.all([loadRows(proc.id), loadLocations()]).then(([rows, locs]) => setData({ rows, locs })).catch(() => setErr(true))
  }, [proc.id])

  useEffect(() => { document.title = `${proc.name} · ${place.name} — Termin blizu` }, [proc, place])

  const head = (
    <div class="summary">
      <button class="picked" onClick={() => go({})} aria-label={`Pregled: ${proc.name}. Promijeni`}>
        <span class="muted small">Pregled</span><strong>{proc.name}</strong><span class="link small">Promijeni</span>
      </button>
      <button class="picked" onClick={() => go({ proc: proc.slug })} aria-label={`Mjesto: ${place.name}. Promijeni`}>
        <span class="muted small">Mjesto</span><strong>{place.name}</strong><span class="link small">Promijeni</span>
      </button>
      <div class="radius" role="group" aria-label="Koliko daleko možeš putovati?">
        <span class="small">Koliko daleko možeš putovati?</span>
        <div class="seg">
          {RADII.map((r) => (
            <button aria-pressed={r === radius} class={r === radius ? 'on' : ''} onClick={() => go({ proc: proc.slug, place: place.slug, r }, true)}>
              {r ? `${r} km` : 'Cijela HR'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  if (err) return <>{head}<p class="notice error">Ne mogu učitati termine. Pokušaj ponovno za minutu.</p></>
  if (!data) return <>{head}<p class="loading">Tražim termine…</p></>

  const R = rank(data.rows, data.locs, place, radius)
  const isControl = /kontroln/i.test(proc.name)

  return (
    <>
      {head}
      {isControl && (
        <p class="notice">ℹ️ Kontrolni pregled se obično obavlja u ustanovi u kojoj si bio na prvom pregledu. Prije nego se naručiš drugdje, provjeri sa svojim liječnikom.</p>
      )}
      <Cards R={R} radius={radius} onDoctor={setSheet} />
      <AlertForm proc={proc} place={place} radius={radius} best={R.bestInRadius} />
      <Share proc={proc} place={place} />

      <section class="list">
        <div class="list-head">
          <h2>Sve ustanove ({R.all.length})</h2>
          <div class="seg small">
            <button class={sort === 'km' ? 'on' : ''} aria-pressed={sort === 'km'} onClick={() => setSort('km')}>Po udaljenosti</button>
            <button class={sort === 'days' ? 'on' : ''} aria-pressed={sort === 'days'} onClick={() => setSort('days')}>Po terminu</button>
          </div>
        </div>
        <ul class="rows">
          {sortOpts(R.all, sort).slice(0, showAll ? undefined : 10).map((o) => (
            <li key={o.locIdx}>
              <div>
                <strong>{label(o.loc)}</strong>
                <span class="muted small">{o.loc.town ? `${o.loc.town} · ` : ''}{fmtTravel(o)}</span>
              </div>
              <div class="rowdays">
                {o.days != null
                  ? <><b>{o.days}</b> <span class="small">{dana(o.days)}</span></>
                  : <span class="muted small">nema svježih podataka</span>}
              </div>
              <Actions o={o} compact onDoctor={() => setSheet(o)} />
            </li>
          ))}
        </ul>
        {!showAll && R.all.length > 10 && (
          <button class="btn secondary wide" onClick={() => setShowAll(true)}>Prikaži još {R.all.length - 10}</button>
        )}
      </section>

      <Explainer />
      {sheet && <DoctorSheet o={sheet} proc={proc} onClose={() => setSheet(null)} />}
    </>
  )
}

function sortOpts(all: Option[], by: 'km' | 'days') {
  const big = 1e9
  return [...all].sort((a, b) =>
    by === 'km'
      ? (a.km ?? big) - (b.km ?? big) || (a.days ?? big) - (b.days ?? big)
      : (a.days ?? big) - (b.days ?? big) || (a.km ?? big) - (b.km ?? big))
}

const label = (l: Location) => (l.sub ? `${l.name} — ${l.sub}` : l.name)

function Cards({ R, radius, onDoctor }: { R: Ranking; radius: number; onDoctor: (o: Option) => void }) {
  const { nearest, bestInRadius, bestOverall } = R
  if (!bestOverall) {
    return <p class="notice">Trenutačno nijedna ustanova ne objavljuje slobodne termine za ovaj pregled. Nazovi ustanove s popisa ispod ili pitaj svog liječnika.</p>
  }
  const same = (a: Option | null, b: Option | null) => !!a && !!b && a.locIdx === b.locIdx
  const cards: { key: string; title: string; o: Option; note?: string }[] = []
  if (nearest) cards.push({ key: 'n', title: 'Najbliže tebi', o: nearest })
  if (bestInRadius && !same(bestInRadius, nearest)) {
    cards.push({ key: 'r', title: radius ? `Najranije do ${radius} km` : 'Najranije u Hrvatskoj', o: bestInRadius })
  } else if (bestInRadius && cards[0]) {
    cards[0].title = radius ? `Najbliže i najranije do ${radius} km` : 'Najbliže i najranije'
  }
  if (!same(bestOverall, bestInRadius) && !same(bestOverall, nearest)) {
    cards.push({ key: 'o', title: 'Najranije u Hrvatskoj', o: bestOverall })
  } else if (radius) {
    const c = cards.find((c) => same(c.o, bestOverall))
    if (c) c.note = 'Ovo je ujedno i najraniji termin u cijeloj Hrvatskoj. 🎉'
  }
  if (!bestInRadius && radius) {
    cards.splice(1, 0, { key: 'x', title: `Do ${radius} km`, o: null as unknown as Option })
  }

  return (
    <div class="cards">
      {cards.map((c) =>
        c.o ? (
          <article class={`card card-${c.key}`} key={c.key}>
            <h2 class="card-title">{c.title}</h2>
            <p class="inst">{label(c.o.loc)}</p>
            <p class="muted">{c.o.loc.town ? `${c.o.loc.town} · ` : ''}{fmtTravel(c.o)}</p>
            <p class="big">
              <span class="num">{c.o.days}</span> {dana(c.o.days!)} <span class="small muted">do prvog slobodnog termina</span>
            </p>
            {c.o.firstSlot && <p class="small">Prvi slobodni termin: <b>{fmtDate(c.o.firstSlot)}</b></p>}
            {compare(c.o, nearest) && <p class="compare">{compare(c.o, nearest)}</p>}
            {c.note && <p class="small">{c.note}</p>}
            <p class="muted small">Ustanova ažurirala {ago(c.o.updated)}</p>
            <Actions o={c.o} onDoctor={() => onDoctor(c.o)} />
          </article>
        ) : (
          <article class="card card-empty" key={c.key}>
            <h2 class="card-title">{c.title}</h2>
            <p>U krugu od {radius} km nema objavljenih termina. Odaberi veću udaljenost gore.</p>
          </article>
        ),
      )}
      {R.stale.length > 0 && (
        <p class="muted small">
          + {R.stale.length} {ustanova(R.stale.length)} u blizini {R.stale.length === 1 ? 'ima' : 'imaju'} ovaj pregled, ali bez svježih termina — vidi popis ispod i nazovi.
        </p>
      )}
    </div>
  )
}

function compare(o: Option, nearest: Option | null): string | null {
  if (!nearest || o.locIdx === nearest.locIdx || o.km == null || nearest.km == null) return null
  const saved = nearest.days! - o.days!
  const extra = o.km - nearest.km
  if (saved <= 0) return null
  return `+${extra} km vožnje → ${saved} ${dana(saved)} ranije nego najbliže`
}

function Actions({ o, compact, onDoctor }: { o: Option; compact?: boolean; onDoctor: () => void }) {
  const tel = o.loc.tel.split(/[,;/]| ili /)[0]?.trim()
  return (
    <div class={compact ? 'actions compact' : 'actions'}>
      {tel && <a class="btn" href={`tel:${tel.replace(/[^\d+]/g, '')}`}>📞 Nazovi</a>}
      {!tel && o.loc.web && (
        <a class="btn" href={o.loc.web.startsWith('http') ? o.loc.web : `https://${o.loc.web}`} target="_blank" rel="noopener">🌐 Kontakt</a>
      )}
      <button class="btn secondary" onClick={onDoctor}>🩺 Pokaži liječniku</button>
      {!compact && o.loc.email && <a class="btn ghost" href={`mailto:${o.loc.email}`}>✉️ E-mail</a>}
    </div>
  )
}

function DoctorSheet({ o, proc, onClose }: { o: Option; proc: Procedure; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])
  return (
    <div class="sheet-bg" onClick={onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h" onClick={(e) => e.stopPropagation()}>
        <h2 id="sheet-h">Pokaži ovo liječniku ili sestri</h2>
        <div class="doctor">
          <p>Molim narudžbu za:</p>
          <p class="xl"><b>{proc.name}</b></p>
          <p>u ustanovi:</p>
          <p class="xl"><b>{label(o.loc)}</b>{o.loc.town ? `, ${o.loc.town}` : ''}</p>
          {o.firstSlot && <p>Prvi slobodni termin u eNaručivanju: <b>{fmtDate(o.firstSlot)}</b></p>}
          <p class="small muted">Izvor: liste.cezih.hr (HZZO), ažurirano {ago(o.updated)}.</p>
        </div>
        <p class="small">Liječnik obiteljske medicine te može naručiti kroz eNaručivanje u bilo koju ustanovu s ovog popisa. Možeš i sam nazvati ustanovu{o.loc.tel ? ` (${o.loc.tel})` : ''} i reći: <em>„Imam uputnicu za {proc.name}, imate li slobodan termin?”</em></p>
        <button class="btn wide" onClick={onClose}>Zatvori</button>
      </div>
    </div>
  )
}

function Share({ proc, place }: { proc: Procedure; place: Place }) {
  const [done, setDone] = useState(false)
  async function share() {
    const url = location.href
    const text = `${proc.name} — gdje je najraniji termin blizu mjesta ${place.name}`
    try {
      if (navigator.share) await navigator.share({ title: 'Termin blizu', text, url })
      else { await navigator.clipboard.writeText(url); setDone(true) }
    } catch { /* user cancelled */ }
  }
  return (
    <div class="share">
      <button class="btn ghost wide" onClick={share}>{done ? '✅ Poveznica kopirana' : '🔗 Pošalji nekome (npr. roditeljima)'}</button>
    </div>
  )
}

function Explainer() {
  return (
    <section class="explain">
      <h2>Što znači ovaj broj?</h2>
      <details>
        <summary>Broj dana = prvi slobodni termin, ne zajamčeno čekanje</summary>
        <p>Prikazujemo prvi slobodni termin koji ustanova objavljuje u državnom sustavu eNaručivanja (liste.cezih.hr). Termini se mijenjaju svakodnevno — prije puta nazovi i potvrdi.</p>
      </details>
      <details>
        <summary>Mogu li se naručiti u drugom gradu?</summary>
        <p>S uputnicom se u pravilu možeš naručiti u bilo koju ustanovu koja ima ugovor s HZZO-om i nudi taj pregled. Najčešće te naruči liječnik obiteljske medicine kroz eNaručivanje — reci mu koju ustanovu želiš. Troškove puta HZZO u pravilu ne pokriva.</p>
      </details>
      <details>
        <summary>Hitno ili sumnja na rak?</summary>
        <p>Ako je stanje hitno, zovi 194 ili 112. Za sumnju na zloćudnu bolest vrijedi kraći rok — reci to liječniku i ustanovi kad se naručuješ.</p>
      </details>
      <details>
        <summary>Kako računamo udaljenost?</summary>
        <p>Udaljenost je procjena (zračna linija × 1,3) od središta tvog mjesta. Za otoke i trajekte stvarno putovanje može biti duže.</p>
      </details>
    </section>
  )
}
