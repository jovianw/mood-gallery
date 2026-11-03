import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { StoryCard, useGradient } from '../components/StoryCard'
import { Button, Screen } from '../components/ui'
import { useNav } from '../lib/nav'
import { decodePayload, hydrate, type SharePayload } from '../lib/share'
import { useAuth } from '../state/AuthContext'

type State = { status: 'loading' } | { status: 'ready'; payload: SharePayload } | { status: 'missing' }

/** Read-only view of a shared walk: /w/g?d=<payload> for guests, /w/<id> from Firestore. */
export function SharedWalk() {
  const { shareId = '' } = useParams()
  const [params] = useSearchParams()
  const nav = useNav()
  const auth = useAuth()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (shareId === 'g') {
        const p = decodePayload(params.get('d') ?? '')
        setState(p ? { status: 'ready', payload: p } : { status: 'missing' })
        return
      }
      const p = auth.loadShare ? await auth.loadShare(shareId).catch(() => null) : null
      if (alive) setState(p ? { status: 'ready', payload: p } : { status: 'missing' })
    }
    void load()
    return () => {
      alive = false
    }
  }, [shareId, params, auth.loadShare])

  const data = useMemo(() => (state.status === 'ready' ? hydrate(state.payload) : null), [state])
  const colors = useGradient(data?.painting.image ?? '')

  return (
    <Screen
      dark
      footer={
        <Button onClick={() => nav.forward('/')} arrow>
          Take your own walk
        </Button>
      }
    >
      <div className="appbar">
        <span />
        <div className="appbar__title">
          <p className="t-label t-label--11 t-label--accent">A Mood Walk</p>
        </div>
        <span />
      </div>
      <div className="gap-16" />
      {state.status === 'loading' && (
        <div className="story-wrap">
          <div className="story story--placeholder" aria-busy="true" />
        </div>
      )}
      {state.status === 'missing' && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <h1 className="t-headline t-headline--italic" style={{ fontSize: 28 }}>
            This walk has wandered off.
          </h1>
          <div className="gap-10" />
          <p className="t-small" style={{ color: 'var(--stone)' }}>
            The link is incomplete or the walk was removed. You can still take one of your own.
          </p>
        </div>
      )}
      {data && (
        <>
          <div className="story-wrap">
            <StoryCard data={data} colors={colors} />
          </div>
          <div className="gap-16" />
          <p className="t-small" style={{ textAlign: 'center', color: 'var(--stone)' }}>
            Someone walked {data.rooms} rooms of The Met and found &ldquo;{data.painting.title}&rdquo;.
          </p>
        </>
      )}
    </Screen>
  )
}
