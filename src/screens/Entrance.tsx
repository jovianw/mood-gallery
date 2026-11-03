import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Arch, ChevronDown, PinSolid, User } from '../components/Icons'
import { MuseumSheet } from '../components/MuseumSheet'
import { Button, Chip, Screen } from '../components/ui'
import { MUSEUM, START_ROOM } from '../data/rooms'
import { useNav } from '../lib/nav'
import { useWalk } from '../state/WalkContext'

export function Entrance() {
  const nav = useNav()
  const walk = useWalk()
  const [sheetOpen, setSheetOpen] = useState(false)

  const enter = () => {
    walk.reset()
    nav.forward(`/room/${START_ROOM}`)
  }

  return (
    <Screen
      footer={
        <Button onClick={enter} arrow>
          Enter {MUSEUM.shortName}
        </Button>
      }
    >
      <div className="brand">
        <Arch style={{ color: 'var(--accent)' }} aria-hidden="true" />
        <p className="brand__name">Mood Gallery</p>
        <Link to="/gallery" className="icon-button" aria-label="My Gallery" onClick={() => nav.markForward()}>
          <User />
        </Link>
      </div>
      <div className="gap-20" />
      <div className="hero" aria-hidden="true">
        <div className="hero__inner">
          <div className="hero__painting" />
        </div>
      </div>
      <div className="gap-22" />
      <h1 className="t-headline">Find the painting that feels like you today.</h1>
      <div className="gap-10" />
      <p className="t-body t-body--15 t-body--muted">
        Answer a few questions and we&rsquo;ll open the right doors for you. Every walk takes a
        different route to a painting picked for your mood.
      </p>
      <div className="gap-20" />
      <div className="selector">
        <PinSolid width={22} height={22} style={{ color: 'var(--accent)' }} aria-hidden="true" />
        <div className="selector__text">
          <span className="t-label">Your museum</span>
          <span className="selector__name">{MUSEUM.name}</span>
        </div>
        <button type="button" className="selector__change" onClick={() => setSheetOpen(true)}>
          Change <ChevronDown width={16} height={16} />
        </button>
      </div>
      <div className="gap-10" />
      <p className="t-caption">Nearby, coming soon:</p>
      <div className="gap-8" />
      <div className="wrap" aria-label="Nearby museums, coming soon">
        {MUSEUM.nearby.map((m) => (
          <Chip key={m.name} muted>
            {m.name}
          </Chip>
        ))}
      </div>
      {sheetOpen && <MuseumSheet onClose={() => setSheetOpen(false)} />}
    </Screen>
  )
}
