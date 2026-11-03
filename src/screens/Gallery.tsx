import { useEffect, useRef, useState } from 'react'
import { EmptyFrame, User } from '../components/Icons'
import { SignInSheet } from '../components/SignInSheet'
import { Button, Chip, IconButton, Screen, TopAppBar } from '../components/ui'
import { MUSEUM, START_ROOM } from '../data/rooms'
import { useNav } from '../lib/nav'
import { useAuth } from '../state/AuthContext'
import { useSaves, type SavedPainting } from '../state/SavesContext'
import { useWalk } from '../state/WalkContext'

function savedDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  if (sameDay) return 'Today'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function firstName(name: string | null, email: string | null): string {
  const n = (name ?? '').trim().split(/\s+/)[0]
  if (n) return n
  if (email) return email.split('@')[0]
  return 'you'
}

function SavedCard({ save, onOpen }: { save: SavedPainting; onOpen: () => void }) {
  return (
    <button type="button" className="saved-card" onClick={onOpen}>
      <img className="saved-card__thumb" src={save.imageUrl} alt="" loading="lazy" />
      <span className="saved-card__text">
        <span className="saved-card__title">{save.title}</span>
        <span className="saved-card__meta">
          {save.artist}, {save.date}
        </span>
        <span className="saved-card__date">
          {savedDate(save.savedAt)} &nbsp;·&nbsp; {MUSEUM.shortName}
        </span>
        <span className="saved-card__chips">
          {save.moodWords.map((w) => (
            <Chip key={w}>{w}</Chip>
          ))}
        </span>
      </span>
    </button>
  )
}

export function Gallery() {
  const nav = useNav()
  const auth = useAuth()
  const saves = useSaves()
  const walk = useWalk()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  const eyebrow = auth.user ? `Signed in as ${firstName(auth.user.displayName, auth.user.email)}` : 'Guest'
  const empty = !saves.loading && saves.saves.length === 0

  const startWalk = () => {
    walk.reset()
    nav.forward(`/room/${START_ROOM}`)
  }

  return (
    <Screen
      center={empty}
      footer={
        <Button onClick={startWalk} arrow>
          {empty ? 'Start a walk' : 'Start a new walk'}
        </Button>
      }
    >
      <TopAppBar
        eyebrow={eyebrow}
        title="My Gallery"
        onLeft={() => nav.back('/')}
        right={
          <IconButton label="Account menu" onClick={() => setMenuOpen((v) => !v)}>
            <User />
          </IconButton>
        }
      />
      {menuOpen && (
        <div className="menu" ref={menuRef} role="menu">
          {auth.user ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                void auth.signOut?.()
              }}
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                setSignInOpen(true)
              }}
            >
              Sign in
            </button>
          )}
        </div>
      )}
      <div className="gap-16" />
      {empty ? (
        <>
          <div className="spacer" />
          <EmptyFrame aria-hidden="true" />
          <div className="gap-20" />
          <h2 className="t-title" style={{ fontSize: 24, lineHeight: 1.2 }}>
            Nothing hanging here yet.
          </h2>
          <div className="gap-8" />
          <p className="t-small">
            Take a walk and save the painting you get. Your gallery keeps every one, with the mood
            you had that day.
          </p>
          <div className="spacer" />
        </>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <span className="stat__n">{saves.walks.length}</span>
              <span className="stat__l">{saves.walks.length === 1 ? 'walk' : 'walks'}</span>
            </div>
            <div className="stat">
              <span className="stat__n">{saves.saves.length}</span>
              <span className="stat__l">{saves.saves.length === 1 ? 'painting saved' : 'paintings saved'}</span>
            </div>
            <div className="stat">
              <span className="stat__n">1</span>
              <span className="stat__l">museum</span>
            </div>
          </div>
          <div className="gap-18" />
          <p className="t-label t-label--11 t-label--accent">Saved paintings</p>
          <div className="gap-10" />
          {saves.saves.map((s, i) => (
            <div key={s.objectID} style={{ width: '100%' }}>
              {i > 0 && <div className="gap-10" />}
              <SavedCard save={s} onOpen={() => nav.forward(`/gallery/${s.objectID}`)} />
            </div>
          ))}
          <div className="gap-10" />
        </>
      )}
      {signInOpen && <SignInSheet onClose={() => setSignInOpen(false)} />}
    </Screen>
  )
}
