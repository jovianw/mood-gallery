import { createContext, useContext, type ReactNode } from 'react'
import type { SharePayload } from '../lib/share'

export interface AuthUser {
  uid: string
  displayName: string | null
  email: string | null
}

export interface AuthState {
  /** Null when signed out or when Firebase is not configured. */
  user: AuthUser | null
  /** False when the VITE_FIREBASE_* variables are missing. */
  configured: boolean
  /** True until the first auth state is known. */
  loading: boolean
  signInWithGoogle?: () => Promise<void>
  sendEmailLink?: (email: string) => Promise<void>
  signOut?: () => Promise<void>
  createShare?: (payload: SharePayload) => Promise<string>
  loadShare?: (id: string) => Promise<SharePayload | null>
}

export const GUEST_AUTH: AuthState = { user: null, configured: false, loading: false }

export const AuthContext = createContext<AuthState>(GUEST_AUTH)

export function GuestAuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={GUEST_AUTH}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
