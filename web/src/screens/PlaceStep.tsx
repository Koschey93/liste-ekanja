import { useMemo, useState } from 'preact/hooks'
import type { Place, Procedure } from '../lib/data'
import { nearestPlace } from '../lib/rank'
import { go } from '../lib/router'
import { searchPlaces } from '../lib/search'
import { Combo } from './Combo'

export function PlaceStep({ proc, places }: { proc: Procedure; places: Place[] | null }) {
  const [q, setQ] = useState('')
  const [geoState, setGeo] = useState<'idle' | 'busy' | 'denied' | 'unsupported'>('idle')
  const hits = useMemo(() => (places ? searchPlaces(places, q) : []), [places, q])

  function useGps() {
    if (!navigator.geolocation) return setGeo('unsupported')
    setGeo('busy')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // snap to the nearest settlement: precise coordinates never leave the device or enter the URL
        const ps = places ?? []
        if (!ps.length) return setGeo('idle')
        const p = nearestPlace(ps, pos.coords.latitude, pos.coords.longitude)
        go({ proc: proc.slug, place: p.slug })
      },
      () => setGeo('denied'),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    )
  }

  return (
    <section class="step">
      <button class="picked" onClick={() => go({})} aria-label="Promijeni pregled">
        <span class="muted small">Pregled</span>
        <strong>{proc.name}</strong>
        <span class="link small">Promijeni</span>
      </button>
      <p class="eyebrow">Korak 2 od 2</p>
      <h1>Gdje živiš?</h1>
      <p class="lead">Upiši grad, mjesto ili selo. Treba nam samo da izračunamo udaljenost.</p>
      <Combo
        value={q}
        onInput={setQ}
        placeholder={places ? 'npr. Bjelovar, Ivanić-Grad, Hvar…' : 'Učitavam popis mjesta…'}
        label="Mjesto"
        items={hits}
        render={(p) => (
          <>
            <span>{p.name}</span>
            <small>{p.county}</small>
          </>
        )}
        onPick={(p) => go({ proc: proc.slug, place: p.slug })}
        empty={q.length >= 2 && places ? 'Ne pronalazimo to mjesto. Probaj najbliži veći grad.' : null}
      />
      <div class="or"><span>ili</span></div>
      <button class="btn secondary wide" onClick={useGps} disabled={!places || geoState === 'busy'}>
        {geoState === 'busy' ? 'Tražim tvoju lokaciju…' : '📍 Koristi moju lokaciju'}
      </button>
      {geoState === 'denied' && <p class="muted small">Lokacija nije dostupna — upiši mjesto ručno.</p>}
      {geoState === 'unsupported' && <p class="muted small">Tvoj preglednik ne podržava lokaciju — upiši mjesto ručno.</p>}
      <p class="muted small">🔒 Lokacija ostaje na tvom uređaju. Ne spremamo je i nikome ne šaljemo.</p>
    </section>
  )
}
