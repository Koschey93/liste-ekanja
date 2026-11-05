import { useEffect, useState } from 'preact/hooks'
import { loadMeta, loadPlaces, loadProcedures, type Meta, type Place, type Procedure } from './lib/data'
import { go, useRoute } from './lib/router'
import { ProcedureStep } from './screens/ProcedureStep'
import { PlaceStep } from './screens/PlaceStep'
import { Results } from './screens/Results'
import { Footer } from './screens/Footer'

export function App() {
  const route = useRoute()
  const [procs, setProcs] = useState<Procedure[] | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([loadProcedures(), loadMeta()]).then(([p, m]) => { setProcs(p); setMeta(m) })
      .catch(() => setError('Ne mogu učitati podatke. Provjeri internetsku vezu i pokušaj ponovno.'))
  }, [])
  // places are ~120 KB gzipped: fetch only once the user is past step 1
  useEffect(() => {
    if (route.proc && !places) loadPlaces().then(setPlaces).catch(() => setError('Ne mogu učitati popis mjesta.'))
  }, [route.proc])

  const proc = procs && route.proc ? procs.find((p) => p.slug === route.proc) : undefined
  const place = places && route.place ? places.find((p) => p.slug === route.place) : undefined

  let body
  if (error) body = <p class="notice error" role="alert">{error}</p>
  else if (!procs) body = <p class="loading">Učitavam…</p>
  else if (!route.proc) body = <ProcedureStep procs={procs} meta={meta} />
  else if (!proc) body = <NotFound what="Taj pregled nismo pronašli." />
  else if (!route.place) body = <PlaceStep proc={proc} places={places} />
  else if (!places) body = <p class="loading">Učitavam…</p>
  else if (!place) body = <NotFound what="To mjesto nismo pronašli." onBack={() => go({ proc: proc.slug })} />
  else body = <Results proc={proc} place={place} radius={route.r ?? 50} />

  return (
    <>
      <header class="top">
        <a href="/" class="brand" onClick={(e) => { e.preventDefault(); go({}) }}>
          <img src="/favicon.svg" alt="" width="28" height="28" /> Termin blizu
        </a>
      </header>
      <main class="wrap">{body}</main>
      <Footer meta={meta} />
    </>
  )
}

function NotFound({ what, onBack }: { what: string; onBack?: () => void }) {
  return (
    <div class="notice">
      <p>{what}</p>
      <button class="btn" onClick={onBack ?? (() => go({}))}>Kreni ispočetka</button>
    </div>
  )
}
