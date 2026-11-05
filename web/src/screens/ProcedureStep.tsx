import { useMemo, useRef, useState } from 'preact/hooks'
import type { Meta, Procedure } from '../lib/data'
import { go } from '../lib/router'
import { POPULAR, searchProcedures } from '../lib/search'
import { ustanova } from '../lib/text'
import { Combo } from './Combo'

export function ProcedureStep({ procs, meta }: { procs: Procedure[]; meta: Meta | null }) {
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const hits = useMemo(() => searchProcedures(procs, q), [procs, q])

  return (
    <section class="step">
      <p class="eyebrow">Korak 1 od 2</p>
      <h1>Na koji pregled trebaš?</h1>
      <p class="lead">Upiši naziv s uputnice ili običnim riječima — npr. <em>srce</em>, <em>magnet koljena</em>, <em>ultrazvuk dojke</em>.</p>
      <Combo
        inputRef={input}
        value={q}
        onInput={setQ}
        placeholder="npr. kardiolog, MR, kolonoskopija…"
        label="Pregled ili pretraga"
        items={hits}
        render={(p) => (
          <>
            <span>{p.name}</span>
            <small>{p.nLoc} {ustanova(p.nLoc)}</small>
          </>
        )}
        onPick={(p) => go({ proc: p.slug })}
        empty={q.length >= 2 ? 'Ništa ne odgovara. Probaj drugu riječ ili samo početak naziva.' : null}
      />
      <div class="chips" aria-label="Često traženo">
        {POPULAR.map((c) => (
          <button class="chip" key={c.label} onClick={() => { setQ(c.q); input.current?.focus() }}>{c.label}</button>
        ))}
      </div>
      {meta && (
        <p class="muted small">
          Pretražuješ {meta.nProcedures} vrsta pregleda i pretraga na {meta.nLocations} mjesta u Hrvatskoj.
        </p>
      )}
    </section>
  )
}
