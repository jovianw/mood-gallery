import { Arch, Chevron, Pin } from '../components/Icons'
import { Button, Chip, Screen } from '../components/ui'
import { MUSEUM, START_ROOM, WALK_SUMMARY } from '../data/rooms'

export function Entrance() {
  return (
    <Screen
      footer={
        <Button to={`/room/${START_ROOM}`} arrow>
          Enter {MUSEUM.shortName}
        </Button>
      }
    >
      <div className="row" style={{ color: 'var(--accent)' }}>
        <Arch />
        <span className="t-room" style={{ color: 'var(--fg)' }}>
          Mood Gallery
        </span>
      </div>
      <div className="gap-20" />
      <div className="hero" aria-hidden="true">
        <div className="hero__inner">
          <div className="hero__painting" />
        </div>
      </div>
      <div className="gap-24" />
      <h1 className="t-headline">Find the painting that feels like you today.</h1>
      <div className="gap-12" />
      <p className="t-body t-body--muted">
        Answer a few questions and we&rsquo;ll open the right doors for you. Every walk takes a
        different route to a painting picked for your mood. {WALK_SUMMARY.rooms} rooms,{' '}
        {WALK_SUMMARY.statements} statements, about {WALK_SUMMARY.minutes} minutes.
      </p>
      <div className="gap-20" />
      <div className="selector">
        <Pin width={22} height={22} style={{ color: 'var(--accent)' }} />
        <div className="selector__text">
          <span className="t-label">Your museum</span>
          <strong>{MUSEUM.name}</strong>
        </div>
        <span className="selector__change" aria-disabled="true">
          Change <Chevron width={16} height={16} />
        </span>
      </div>
      <div className="gap-12" />
      <p className="t-small">Nearby, coming soon:</p>
      <div className="gap-8" />
      <div className="wrap">
        {MUSEUM.nearby.map((m) => (
          <Chip key={m}>{m}</Chip>
        ))}
      </div>
    </Screen>
  )
}
