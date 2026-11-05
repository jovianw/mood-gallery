import { BottomSheet } from './BottomSheet'
import { CheckCircle, Pin, PinSolid } from './Icons'
import { MUSEUM } from '../data/rooms'

const REQUEST_MAILTO =
  'mailto:jlw457@cornell.edu?subject=' +
  encodeURIComponent('Mood Gallery: please add a museum') +
  '&body=' +
  encodeURIComponent('Hi Jovian,\n\nI would love to take a Mood Walk at:\n\n')

export function MuseumSheet({ onClose }: { onClose: () => void }) {
  return (
    <BottomSheet onClose={onClose} label="Choose your museum">
      {(close) => (
        <>
          <h2 className="sheet__title">Choose your museum</h2>
          <div className="gap-4" />
          <p className="sheet__copy">
            Mood Gallery works with museums that publish their collections openly. More are on the
            way.
          </p>
          <div className="gap-18" />
          <button type="button" className="museum-row museum-row--selected" onClick={close} aria-pressed="true">
            <PinSolid width={22} height={22} style={{ color: 'var(--accent)' }} aria-hidden="true" />
            <span className="museum-row__text">
              <span className="museum-row__name">{MUSEUM.name}</span>
              <span className="museum-row__sub">
                {MUSEUM.city} &nbsp;·&nbsp; {MUSEUM.works} &nbsp;·&nbsp; Open Access
              </span>
            </span>
            <CheckCircle width={22} height={22} style={{ color: 'var(--accent)' }} aria-hidden="true" />
          </button>
          {MUSEUM.nearby.map((m) => (
            <div key={m.name} style={{ width: '100%' }}>
              <div className="gap-10" />
              <button type="button" className="museum-row" disabled>
                <Pin width={22} height={22} style={{ color: 'var(--mute-gray)' }} aria-hidden="true" />
                <span className="museum-row__text">
                  <span className="museum-row__name">{m.name}</span>
                  <span className="museum-row__sub">{m.city} &nbsp;·&nbsp; Coming soon</span>
                </span>
              </button>
            </div>
          ))}
          <div className="gap-16" />
          <a className="t-link t-link--accent" href={REQUEST_MAILTO} style={{ textAlign: 'center' }}>
            Request a museum
          </a>
        </>
      )}
    </BottomSheet>
  )
}
