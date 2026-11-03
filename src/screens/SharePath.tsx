import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Download, Link as LinkIcon, Message, PlusSquare } from '../components/Icons'
import { StoryCard, useExportableImage, useGradient } from '../components/StoryCard'
import { Screen, TopAppBar, useToast } from '../components/ui'
import { MUSEUM } from '../data/rooms'
import { useNav } from '../lib/nav'
import {
  buildPayload,
  canShareFiles,
  downloadBlob,
  exportCardPng,
  hydrate,
  shareUrl,
} from '../lib/share'
import { useAuth } from '../state/AuthContext'
import { useWalk } from '../state/WalkContext'

export function SharePath() {
  const nav = useNav()
  const walk = useWalk()
  const auth = useAuth()
  const [toast, showToast] = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [shareId, setShareId] = useState<string | null>(null)

  const painting = walk.painting
  const doorId = walk.doorId

  const payload = useMemo(
    () =>
      painting && doorId
        ? buildPayload({
            date: walk.finishedAt ?? new Date(),
            roomId: doorId,
            painting,
            mood: walk.mood,
            stops: walk.stops,
          })
        : null,
    [painting, doorId, walk.finishedAt, walk.mood, walk.stops],
  )
  const data = useMemo(() => (payload ? hydrate(payload) : null), [payload])
  const colors = useGradient(painting?.image ?? '')
  const thumb = useExportableImage(painting?.image ?? '')

  if (!painting || !doorId || !payload || !data) return <Navigate to="/" replace />
  if (!walk.resolved) return <Navigate to="/finding" replace />

  const text = `My Mood Walk at ${MUSEUM.shortName}: ${data.sentence} It led me to "${painting.title}" by ${painting.artist}.`

  // Dev-only check: `?export=1` renders the exported PNG under the card so it can be eyeballed.
  const [exportPreview, setExportPreview] = useState<{ url: string; w: number; h: number; ms: number } | null>(null)
  useEffect(() => {
    if (!import.meta.env.DEV || !new URLSearchParams(window.location.search).has('export')) return
    const t0 = Date.now()
    const timer = setTimeout(async () => {
      if (!cardRef.current) return
      const blob = await exportCardPng(cardRef.current)
      const bmp = await createImageBitmap(blob)
      setExportPreview({ url: URL.createObjectURL(blob), w: bmp.width, h: bmp.height, ms: Date.now() - t0 })
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  /** Signed-in users get a short Firestore id; guests carry the walk in the URL. */
  const getLink = async (): Promise<string> => {
    if (shareId) return shareUrl(shareId, payload)
    if (auth.user && auth.createShare) {
      try {
        const id = await auth.createShare(payload)
        setShareId(id)
        return shareUrl(id)
      } catch {
        /* fall through to the guest link */
      }
    }
    setShareId('g')
    return shareUrl('g', payload)
  }

  const getPng = async (): Promise<Blob> => {
    if (!cardRef.current) throw new Error('card not ready')
    return exportCardPng(cardRef.current)
  }

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      return true
    } catch {
      return false
    }
  }

  const fallbackSaveAndCopy = async () => {
    const [blob, url] = await Promise.all([getPng(), getLink()])
    downloadBlob(blob, 'mood-walk.png')
    const ok = await copy(url)
    showToast(ok ? 'Saved image, link copied' : 'Saved image')
  }

  const run = (key: string, fn: () => Promise<void>) => async () => {
    if (busy) return
    setBusy(key)
    try {
      await fn()
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') showToast('That did not work. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const shareStory = run('story', async () => {
    if (canShareFiles()) {
      const [blob, url] = await Promise.all([getPng(), getLink()])
      const file = new File([blob], 'mood-walk.png', { type: 'image/png' })
      await navigator.share({ files: [file], title: 'My Mood Walk', text, url })
    } else {
      await fallbackSaveAndCopy()
    }
  })

  const shareMessages = run('messages', async () => {
    const url = await getLink()
    if (navigator.share) {
      await navigator.share({ title: 'My Mood Walk', text, url })
    } else {
      await fallbackSaveAndCopy()
    }
  })

  const saveImage = run('save', async () => {
    const blob = await getPng()
    downloadBlob(blob, 'mood-walk.png')
    showToast('Saved image')
  })

  const copyLink = run('copy', async () => {
    const url = await getLink()
    showToast((await copy(url)) ? 'Link copied' : 'Could not copy on this browser')
  })

  return (
    <Screen dark>
      <TopAppBar eyebrow="Share your path" left="close" onLeft={() => nav.back('/painting')} />
      <div className="gap-16" />
      <div className="story-wrap">
        <StoryCard ref={cardRef} data={data} colors={colors} thumb={thumb} />
      </div>
      <div className="gap-22" />
      <div className="share-actions">
        <button type="button" className="share-action" onClick={shareStory} disabled={!!busy}>
          <span className="share-action__icon share-action__icon--accent">
            <PlusSquare width={22} height={22} />
          </span>
          Story
        </button>
        <button type="button" className="share-action" onClick={shareMessages} disabled={!!busy}>
          <span className="share-action__icon">
            <Message width={22} height={22} />
          </span>
          Messages
        </button>
        <button type="button" className="share-action" onClick={saveImage} disabled={!!busy}>
          <span className="share-action__icon">
            <Download width={22} height={22} />
          </span>
          Save image
        </button>
        <button type="button" className="share-action" onClick={copyLink} disabled={!!busy}>
          <span className="share-action__icon">
            <LinkIcon width={22} height={22} />
          </span>
          Copy link
        </button>
      </div>
      {busy && (
        <p className="t-caption" style={{ textAlign: 'center', marginTop: 14 }} aria-live="polite">
          Making your card…
        </p>
      )}
      {exportPreview && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <p className="t-caption">
            export {exportPreview.w}x{exportPreview.h} in {exportPreview.ms} ms
          </p>
          <img src={exportPreview.url} alt="" style={{ width: 150, display: 'block', margin: '8px auto' }} />
        </div>
      )}
      {toast}
    </Screen>
  )
}
