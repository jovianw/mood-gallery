/** Guest-side persistence. Keys follow the handoff: mg.saves, mg.walks, mg.guestId, mg.obj.<id>. */

export const KEYS = {
  saves: 'mg.saves',
  walks: 'mg.walks',
  guestId: 'mg.guestId',
  object: (id: number) => `mg.obj.${id}`,
  emailForSignIn: 'mg.emailForSignIn',
} as const

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode or storage disabled: persistence is a nicety, not a requirement */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Stable random id for this browser, used for the daily painting seed and guest shares. */
export function getGuestId(): string {
  const existing = readJson<string | null>(KEYS.guestId, null)
  if (existing) return existing
  const id = randomId()
  writeJson(KEYS.guestId, id)
  return id
}
