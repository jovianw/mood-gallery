import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Auth, User } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { firebaseConfigured, getFirebase } from '../lib/firebase'
import type { SharePayload } from '../lib/share'
import { KEYS, readJson, removeKey, writeJson } from '../lib/storage'
import { AuthContext, GUEST_AUTH, type AuthState, type AuthUser } from './AuthContext'

function toAuthUser(u: User): AuthUser {
  return { uid: u.uid, displayName: u.displayName, email: u.email }
}

/** Where the email sign-in link lands. The gallery is a sensible place to arrive signed in. */
function emailLinkReturnUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}gallery?signin=email`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<{ auth: Auth; db: Firestore } | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(firebaseConfigured)

  useEffect(() => {
    if (!firebaseConfigured) return
    let unsub: (() => void) | undefined
    let alive = true
    ;(async () => {
      const fb = await getFirebase()
      if (!alive) return
      if (!fb) {
        setLoading(false)
        return
      }
      setServices({ auth: fb.auth, db: fb.db })
      const { onAuthStateChanged, isSignInWithEmailLink, signInWithEmailLink } = await import('firebase/auth')
      unsub = onAuthStateChanged(fb.auth, (u) => {
        setUser(u ? toAuthUser(u) : null)
        setLoading(false)
      })
      // Finish an email-link sign-in if we arrived through one.
      if (isSignInWithEmailLink(fb.auth, window.location.href)) {
        let email = readJson<string | null>(KEYS.emailForSignIn, null)
        if (!email) email = window.prompt('Confirm the email address you used to get this link') ?? ''
        if (email) {
          try {
            await signInWithEmailLink(fb.auth, email, window.location.href)
            removeKey(KEYS.emailForSignIn)
            const clean = new URL(window.location.href)
            clean.search = ''
            window.history.replaceState({}, '', clean.toString())
          } catch (err) {
            console.warn('Email link sign-in failed', err)
          }
        }
      }
    })()
    return () => {
      alive = false
      unsub?.()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!services) throw new Error('Firebase is not configured')
    const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth')
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(services.auth, provider)
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(services.auth, provider)
        return
      }
      throw err
    }
  }, [services])

  const sendEmailLink = useCallback(
    async (email: string) => {
      if (!services) throw new Error('Firebase is not configured')
      const { sendSignInLinkToEmail } = await import('firebase/auth')
      await sendSignInLinkToEmail(services.auth, email, { url: emailLinkReturnUrl(), handleCodeInApp: true })
      writeJson(KEYS.emailForSignIn, email)
    },
    [services],
  )

  const signOut = useCallback(async () => {
    if (!services) return
    const { signOut: fbSignOut } = await import('firebase/auth')
    await fbSignOut(services.auth)
  }, [services])

  const createShare = useCallback(
    async (payload: SharePayload) => {
      if (!services || !user) throw new Error('Not signed in')
      const { addDoc, collection } = await import('firebase/firestore')
      const ref = await addDoc(collection(services.db, 'shares'), {
        ...payload,
        ownerUid: user.uid,
        createdAt: new Date().toISOString(),
      })
      return ref.id
    },
    [services, user],
  )

  const loadShare = useCallback(
    async (id: string): Promise<SharePayload | null> => {
      const fb = services ?? (await getFirebase())
      if (!fb) return null
      const { doc, getDoc } = await import('firebase/firestore')
      const snap = await getDoc(doc(fb.db, 'shares', id))
      if (!snap.exists()) return null
      const data = snap.data() as SharePayload & { ownerUid?: string; createdAt?: string }
      return data.v === 1 ? data : null
    },
    [services],
  )

  const value = useMemo<AuthState>(() => {
    if (!firebaseConfigured) return GUEST_AUTH
    return {
      user,
      configured: true,
      loading,
      signInWithGoogle,
      sendEmailLink,
      signOut,
      createShare,
      loadShare,
    }
  }, [user, loading, signInWithGoogle, sendEmailLink, signOut, createShare, loadShare])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
