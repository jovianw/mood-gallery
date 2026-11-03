import { forwardRef, useEffect, useState } from 'react'
import { MUSEUM, rooms, START_ROOM } from '../data/rooms'
import type { RouteStop } from '../data/types'
import { FALLBACK_GRADIENT, sampleGradient, toCss, tone, type Rgb } from '../lib/colors'
import { galleryLabel } from '../lib/floorplan'
import { fetchImageBlobUrl, formatWalkDate, type ShareCardData } from '../lib/share'
import { Arch } from './Icons'
import { ShareRouteMap } from './ShareRouteMap'

type LogRow = { kind: 'stop'; stop: RouteStop; index: number } | { kind: 'more'; count: number }

/** The card has room for four stops: the hall, the first room, a "N more rooms" line, the last room. */
function logRows(stops: RouteStop[]): LogRow[] {
  const rows: LogRow[] = stops.map((stop, index) => ({ kind: 'stop', stop, index }))
  if (rows.length <= 4) return rows
  return [rows[0], rows[1], { kind: 'more', count: rows.length - 3 }, rows[rows.length - 1]]
}

export function useGradient(image: string): Rgb[] {
  const [colors, setColors] = useState<Rgb[]>(FALLBACK_GRADIENT)
  useEffect(() => {
    let alive = true
    sampleGradient(image).then((c) => {
      if (alive) setColors(c)
    })
    return () => {
      alive = false
    }
  }, [image])
  return colors
}

/** Same-origin copy of the thumbnail for export; null while loading or when CORS is refused. */
export function useExportableImage(src: string): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let made: string | null = null
    fetchImageBlobUrl(src).then((u) => {
      if (!alive) {
        if (u) URL.revokeObjectURL(u)
        return
      }
      made = u
      setUrl(u)
    })
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [src])
  return url
}

interface StoryCardProps {
  data: ShareCardData
  colors: Rgb[]
  /** Blob URL of the thumbnail when it could be fetched with CORS. */
  thumb?: string | null
  /** Exports render the card at the same CSS size; the PNG scale is applied by html-to-image. */
  exporting?: boolean
}

/** The 9:16 share card. 300x533 on screen, rendered to 1080x1920 for export. */
export const StoryCard = forwardRef<HTMLDivElement, StoryCardProps>(function StoryCard(
  { data, colors, thumb, exporting },
  ref,
) {
  const { payload, painting, route, sentence, answers, destinationPhrase } = data
  const [top, mid, bottom] = colors.map((c) => tone(c))
  const dest = galleryLabel(painting)
  const [first, ...rest] = sentence.split(', ')
  const firstLine = rest.length ? `${first}, ${rest[0]},` : sentence
  const secondLine = rest.length > 1 ? rest.slice(1).join(', ') : ''

  return (
    <div
      ref={ref}
      className={`story ${exporting ? 'story--export' : ''}`}
      style={{ background: `linear-gradient(180deg, ${toCss(top)} 0%, ${toCss(mid)} 55%, ${toCss(bottom)} 100%)` }}
      aria-label="Your Mood Walk story card"
    >
      <div className="story__header">
        <span className="story__eyebrow">My Mood Walk</span>
        <span className="story__date">
          {formatWalkDate(payload.date)} &nbsp;·&nbsp; {MUSEUM.shortName}
        </span>
      </div>
      <div className="gap-10" />
      <p className="story__mood">
        {firstLine}
        {secondLine && (
          <>
            <br />
            {secondLine}
          </>
        )}
      </p>
      <div className="gap-10" />
      <div className="story__map">
        <ShareRouteMap route={route} destinationLabel={dest} />
      </div>
      <div className="gap-12" />
      <div className="story__stats">
        <div className="story__stat">
          <span>{data.rooms}</span>
          <small>rooms</small>
        </div>
        <div className="story__stat">
          <span>{answers}</span>
          <small>answers</small>
        </div>
        <div className="story__stat">
          <span>{route.minutes} min</span>
          <small>walk</small>
        </div>
      </div>
      <div className="gap-8" />
      <ul className="story__log">
        {logRows(payload.stops).map((row) =>
          row.kind === 'more' ? (
            <li key="more" className="is-more">
              <i />
              <span>{row.count === 1 ? '1 more room' : `${row.count} more rooms`}</span>
            </li>
          ) : (
            <li key={row.stop.roomId}>
              <i />
              <b>{row.stop.roomId === START_ROOM ? 'Great Hall' : rooms[row.stop.roomId]?.name}</b>
              <span>
                &nbsp;·&nbsp; {row.index === 0 ? `Arrived ${row.stop.moodPhrase.toLowerCase()}` : row.stop.moodPhrase}
              </span>
            </li>
          ),
        )}
        <li>
          <i className="is-dest" />
          <b>{dest}</b>
          <span>&nbsp;·&nbsp; {destinationPhrase}</span>
        </li>
      </ul>
      <div className="spacer" />
      <div className="story__painting">
        <img
          className="story__thumb"
          src={thumb ?? painting.image}
          alt=""
          data-skip-export={thumb ? undefined : 'true'}
        />
        <div className="story__ptext">
          <div className="story__title">{painting.title}</div>
          <div className="story__meta">
            {painting.artist}, {painting.date}
          </div>
        </div>
      </div>
      <div className="gap-10" />
      <div className="story__footer">
        <Arch size={18} style={{ color: '#E4002B' }} aria-hidden="true" />
        <span className="story__brand">Mood Gallery</span>
        <span className="story__credit">Image: The Metropolitan Museum of Art</span>
      </div>
    </div>
  )
})
