import { useCallback, useEffect, useRef, useState } from 'react'

// Keep the previous object for any key whose content did not change,
// so the map only re-renders the parts that actually changed.
function shareUnchanged(prev, next, cache) {
  if (!prev) return next
  const merged = {}
  for (const key of Object.keys(next)) {
    const json = JSON.stringify(next[key])
    merged[key] = cache[key] === json ? prev[key] : next[key]
    cache[key] = json
  }
  return merged
}

// Call `fetcher` now and every `intervalMs`; `refresh()` fetches immediately (e.g. after issuing an alert)
export function usePolling(fetcher, intervalMs) {
  const [state, setState] = useState({ data: null, error: null, updatedAt: null })
  const [nonce, setNonce] = useState(0)
  const cacheRef = useRef({})

  useEffect(() => {
    let cancelled = false

    async function tick() {
      try {
        const next = await fetcher()
        if (cancelled) return
        setState((prev) => ({
          data: shareUnchanged(prev.data, next, cacheRef.current),
          error: null,
          updatedAt: new Date(),
        }))
      } catch (error) {
        if (!cancelled) setState((prev) => ({ ...prev, error }))
      }
    }

    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [fetcher, intervalMs, nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, refresh }
}
