import type { Meta } from '../lib/data'
import { ago } from '../lib/text'

export function Footer({ meta }: { meta: Meta | null }) {
  return (
    <footer class="foot">
      <div class="wrap">
        <p>
          Podaci: <a href="https://liste.cezih.hr" target="_blank" rel="noopener">liste.cezih.hr</a> (HZZO)
          {meta && <> · osvježeno {ago(meta.fetched)}</>}. Točnost podataka je u nadležnosti zdravstvenih ustanova.
        </p>
        <p>Termin blizu nije službena stranica HZZO-a niti Ministarstva zdravstva i ne daje medicinske savjete. Za hitna stanja zovi <b>194</b> ili <b>112</b>.</p>
        <p class="small"><a href="/privatnost.html">Privatnost</a> · Bez kolačića · Bez registracije</p>
      </div>
    </footer>
  )
}
