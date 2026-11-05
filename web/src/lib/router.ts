import { useEffect, useState } from 'preact/hooks'

export type Route = { proc?: string; place?: string; r?: number }

export function parse(loc: Location = window.location): Route {
  const [proc, place] = loc.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const r = Number(new URLSearchParams(loc.search).get('r'))
  return { proc, place, r: Number.isFinite(r) && loc.search.includes('r=') ? r : undefined }
}

export function href(r: Route): string {
  let p = '/'
  if (r.proc) p += r.proc
  if (r.proc && r.place) p += '/' + r.place
  if (r.place && r.r != null) p += `?r=${r.r}`
  return p
}

export function go(r: Route, replace = false) {
  const url = href(r)
  if (url === location.pathname + location.search) return
  history[replace ? 'replaceState' : 'pushState'](null, '', url)
  dispatchEvent(new PopStateEvent('popstate'))
  if (!replace) window.scrollTo(0, 0)
}

export function useRoute(): Route {
  const [route, set] = useState(parse())
  useEffect(() => {
    const on = () => set(parse())
    addEventListener('popstate', on)
    return () => removeEventListener('popstate', on)
  }, [])
  return route
}
