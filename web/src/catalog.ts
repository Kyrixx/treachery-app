import { useEffect, useState } from 'react'
import type { Catalog } from './types'

let cached: Promise<Catalog> | null = null

export function clearCatalogCache() {
  cached = null
}

function loadCatalog() {
  cached ??= fetch('/api/catalog').then((res) => {
    if (!res.ok) throw new Error(String(res.status))
    return res.json() as Promise<Catalog>
  })
  // a failed load is retried the next time the guide opens
  cached.catch(() => (cached = null))
  return cached
}

export function useCatalog() {
  const [state, setState] = useState<{ catalog?: Catalog; failed?: boolean }>({})
  useEffect(() => {
    let live = true
    loadCatalog().then(
      (catalog) => live && setState({ catalog }),
      () => live && setState({ failed: true }),
    )
    return () => {
      live = false
    }
  }, [])
  return state
}
