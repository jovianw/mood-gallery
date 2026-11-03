import { lazy, type ComponentType } from 'react'

const RETRY_KEY = 'mg.chunkRetry'

/**
 * React.lazy that survives a stale deploy. When a code-split chunk fails to load (old hashes
 * after a new build, a flaky connection, a dev server re-optimizing), reload the page once so
 * the browser picks up the current bundle. A second failure in the same session surfaces to the
 * error boundary instead of looping.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same constraint React.lazy uses
export function lazyWithRetry<T extends ComponentType<any>>(importer: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await importer()
      sessionStorage.removeItem(RETRY_KEY)
      return mod
    } catch (err) {
      let retried = false
      try {
        retried = sessionStorage.getItem(RETRY_KEY) === '1'
        if (!retried) sessionStorage.setItem(RETRY_KEY, '1')
      } catch {
        // storage blocked; fall through and surface the error
      }
      if (!retried && typeof window !== 'undefined') {
        window.location.reload()
        // Keep the suspense fallback up until the reload lands.
        return new Promise<{ default: T }>(() => {})
      }
      throw err
    }
  })
}
