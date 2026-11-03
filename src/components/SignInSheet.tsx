import { useState } from 'react'
import { useAuth } from '../state/AuthContext'
import { BottomSheet } from './BottomSheet'
import { Google, Mail } from './Icons'

type Step = 'choose' | 'email' | 'sent'

/**
 * Sign-in sheet shown over Your Painting when a guest taps Save (and from the gallery menu).
 * `onSignedIn` fires after a successful Google sign-in; `onNotNow` keeps the save on this device.
 */
export function SignInSheet({
  onClose,
  onSignedIn,
  onNotNow,
  title = 'Keep this one',
  copy = 'Sign in to save paintings to your gallery and see them from any device. Free, and we never post anything for you.',
  notNowLabel = 'Not now, keep it on this device only',
}: {
  onClose: () => void
  onSignedIn?: () => void
  onNotNow?: () => void
  title?: string
  copy?: string
  notNowLabel?: string
}) {
  const auth = useAuth()
  const [step, setStep] = useState<Step>('choose')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <BottomSheet onClose={onClose} label={title}>
      {(close) => (
        <>
          <h2 className="sheet__title">{title}</h2>
          <div className="gap-4" />
          <p className="sheet__copy">{copy}</p>
          <div className="gap-20" />
          {!auth.configured ? (
            <p className="t-small" style={{ textAlign: 'center' }}>
              Sign-in is not set up yet. Your saves stay on this device for now.
            </p>
          ) : step === 'sent' ? (
            <p className="t-body" style={{ textAlign: 'center' }}>
              Check your inbox. We sent a sign-in link to <strong>{email}</strong>.
            </p>
          ) : step === 'email' ? (
            <form
              style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}
              onSubmit={async (e) => {
                e.preventDefault()
                if (!auth.sendEmailLink || !email) return
                setBusy(true)
                setError(null)
                try {
                  await auth.sendEmailLink(email.trim())
                  setStep('sent')
                } catch {
                  setError('We could not send the link. Check the address and try again.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              <input
                className="field"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
              <button type="submit" className="btn btn--primary" disabled={busy || !email}>
                {busy ? 'Sending…' : 'Send the link'}
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--outline"
                disabled={busy}
                onClick={async () => {
                  if (!auth.signInWithGoogle) return
                  setBusy(true)
                  setError(null)
                  try {
                    await auth.signInWithGoogle()
                    onSignedIn?.()
                    close()
                  } catch (err) {
                    const code = (err as { code?: string }).code ?? ''
                    if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
                      setError('Google sign-in did not go through. Try again or use an email link.')
                    }
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Google width={20} height={20} /> Continue with Google
              </button>
              <div className="gap-10" />
              <button type="button" className="btn btn--outline-soft" onClick={() => setStep('email')}>
                <Mail width={20} height={20} /> Email me a sign-in link
              </button>
            </>
          )}
          {error && (
            <>
              <div className="gap-10" />
              <p className="t-small" style={{ color: 'var(--accent)', textAlign: 'center' }}>
                {error}
              </p>
            </>
          )}
          <div className="gap-18" />
          <button
            type="button"
            className="t-link t-link--muted"
            style={{ alignSelf: 'center' }}
            onClick={() => {
              onNotNow?.()
              close()
            }}
          >
            {notNowLabel}
          </button>
          <div className="gap-8" />
          <p className="t-caption" style={{ textAlign: 'center' }}>
            Guest saves live in this browser and are lost if you clear it.
          </p>
        </>
      )}
    </BottomSheet>
  )
}
