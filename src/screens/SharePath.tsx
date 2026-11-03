import { Navigate, useNavigate } from 'react-router-dom'
import { Arch, Bookmark, Share } from '../components/Icons'
import { Screen, TopAppBar, useToast } from '../components/ui'
import { MUSEUM, rooms, START_ROOM } from '../data/rooms'
import { moodSentence } from '../lib/matching'
import { useWalk } from '../state/WalkContext'

export function SharePath() {
  const navigate = useNavigate()
  const walk = useWalk()
  const [toast, showToast] = useToast()
  const painting = walk.painting

  if (!painting || !walk.doorId) return <Navigate to="/" replace />

  const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const stops = [rooms[START_ROOM].name, rooms[walk.doorId].name, painting.gallery ? `Gallery ${painting.gallery}` : 'Your painting']
  const text = `My Mood Walk at ${MUSEUM.shortName}: ${moodSentence(walk.mood)} It led me to "${painting.title}" by ${painting.artist}.`
  const url = window.location.origin + import.meta.env.BASE_URL

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Mood Walk', text, url })
      } catch {
        /* user dismissed the sheet */
      }
    } else {
      await copy()
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      showToast('Copied to clipboard')
    } catch {
      showToast('Could not copy on this browser')
    }
  }

  return (
    <Screen dark>
      <TopAppBar eyebrow="Share your path" left="close" onLeft={() => navigate('/painting')} />
      <div className="gap-16" />
      {/* The story card breaks the palette on purpose: it borrows colours from the painting. */}
      <div className="story" aria-label="Story card">
        <div className="story__header">
          <span>My Mood Walk</span>
          <span>
            {date} · {MUSEUM.shortName}
          </span>
        </div>
        <p className="story__mood">{moodSentence(walk.mood)}</p>
        <svg className="story__route" viewBox="0 0 256 120" aria-hidden="true">
          <path d="M12 96 C 70 96, 90 30, 128 30 S 190 96, 244 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeDasharray="6 5" />
          <circle cx="12" cy="96" r="6" fill="#fff" />
          <circle cx="128" cy="30" r="6" fill="#fff" />
          <circle cx="244" cy="24" r="8" fill="#e4002b" stroke="#fff" strokeWidth="2.5" />
        </svg>
        <div className="story__legend">
          {stops.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
        <div className="story__painting">
          <img className="story__thumb" src={painting.image} alt="" />
          <div>
            <div className="story__title">{painting.title}</div>
            <div className="story__meta">
              {painting.artist}, {painting.date}
            </div>
          </div>
        </div>
        <div className="story__footer">
          <Arch size={18} style={{ color: '#e4002b' }} /> Mood Gallery
        </div>
      </div>
      <div className="gap-24" />
      <div className="share-actions">
        <button type="button" className="share-action" onClick={share}>
          <span className="share-action__icon">
            <Share width={22} height={22} />
          </span>
          Share
        </button>
        <button type="button" className="share-action" onClick={copy}>
          <span className="share-action__icon">
            <Bookmark width={22} height={22} />
          </span>
          Copy link
        </button>
      </div>
      <div className="gap-12" />
      <p className="t-small" style={{ textAlign: 'center' }}>
        Saving the card as an image is coming soon.
      </p>
      {toast}
    </Screen>
  )
}
