import { useState } from 'preact/hooks'
import type { Place, Procedure } from '../lib/data'
import type { Option } from '../lib/rank'

const API = import.meta.env.VITE_API_BASE ?? ''
const DAY_CHOICES = [7, 14, 30, 60, 90]

export function AlertForm({ proc, place, radius, best }: { proc: Procedure; place: Place; radius: number; best: Option | null }) {
  // suggest a threshold that is meaningfully better than what is available now
  // (about half of today's wait, never more than 30 days, never less than 7)
  const current = best?.days ?? null
  const target = current == null ? 30 : Math.min(30, current / 2)
  const suggested = [...DAY_CHOICES].reverse().find((d) => d <= target) ?? 7
  const [days, setDays] = useState(suggested)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function submit(e: Event) {
    e.preventDefault()
    setState('sending')
    try {
      const r = await fetch(`${API}/api/subscribe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email, procId: proc.id, procName: proc.name, procSlug: proc.slug,
          placeName: place.name, placeSlug: place.slug,
          lat: Math.round(place.lat * 100) / 100, lon: Math.round(place.lon * 100) / 100,
          radiusKm: radius, maxDays: days,
        }),
      })
      setState(r.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <section class="alert done" aria-live="polite">
        <h2>📬 Provjeri e-mail</h2>
        <p>Poslali smo ti poveznicu za potvrdu na <b>{email}</b>. Obavijest uključujemo tek kad klikneš na nju.</p>
      </section>
    )
  }

  return (
    <section class="alert">
      <h2>🔔 Javi mi kad se pojavi raniji termin</h2>
      <form onSubmit={submit}>
        <p class="alert-sentence">
          Pošalji mi e-mail kad se za ovaj pregled pojavi termin unutar{' '}
          <select value={days} onChange={(e) => setDays(Number((e.target as HTMLSelectElement).value))} aria-label="Broj dana">
            {DAY_CHOICES.map((d) => <option value={d}>{d} dana</option>)}
          </select>{' '}
          {radius ? <>do <b>{radius} km</b> od mjesta {place.name}</> : <>bilo gdje u Hrvatskoj</>}.
        </p>
        <label class="sr-only" for="alert-email">E-mail adresa</label>
        <div class="alert-row">
          <input id="alert-email" type="email" required autoComplete="email" inputMode="email"
            placeholder="tvoj@email.hr" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
          <button class="btn" disabled={state === 'sending'}>{state === 'sending' ? 'Šaljem…' : 'Obavijesti me'}</button>
        </div>
        {state === 'error' && <p class="error small" role="alert">Nešto nije u redu. Pokušaj ponovno malo kasnije.</p>}
        <p class="muted small">Spremamo samo e-mail i ove postavke. Najviše jedan e-mail dnevno, odjava jednim klikom, obavijest se sama briše nakon 90 dana.</p>
      </form>
    </section>
  )
}
