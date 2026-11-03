import type { Door, Room, RoomId } from './types'

export const MUSEUM = {
  name: 'The Met Fifth Avenue',
  shortName: 'The Met',
  nearby: ['MoMA', 'Guggenheim', 'Brooklyn Museum'],
}

export const rooms: Record<RoomId, Room> = {
  'great-hall': {
    id: 'great-hall',
    name: 'The Great Hall',
    about:
      "Every walk starts here, under the domes of The Met's front hall. Take a breath. Tell us how you're arriving today.",
    statements: [
      { id: 'gh-1', text: 'My mind has been racing lately.', axis: 'energy', direction: 1 },
      { id: 'gh-2', text: 'I could use some warmth today.', axis: 'warmth', direction: 1 },
      { id: 'gh-3', text: "I'd rather be around people than on my own right now.", axis: 'focus', direction: -1 },
    ],
    next: 'doors',
    buttonLabel: 'Find my door',
  },
  'european-paintings': {
    id: 'european-paintings',
    name: 'European Paintings',
    about:
      'Portraits, saints and stormy seas from 1250 to 1800. These painters used light to show what people were feeling.',
    statements: [
      { id: 'ep-1', text: 'Something has been weighing on me.', axis: 'outlook', direction: -1 },
      { id: 'ep-2', text: 'I feel settled in myself today.', axis: 'energy', direction: -1 },
      { id: 'ep-3', text: "I'm looking forward to what comes next.", axis: 'outlook', direction: 1 },
    ],
    next: 'final',
    buttonLabel: 'Show my final stretch',
  },
  'nineteenth-century': {
    id: 'nineteenth-century',
    name: '19th-Century European Paintings',
    about:
      'Light, weather and ordinary afternoons, painted fast and outdoors. The Impressionists cared more about how a moment felt than how it looked.',
    statements: [
      { id: 'nc-1', text: 'I want the day to slow down.', axis: 'energy', direction: -1 },
      { id: 'nc-2', text: "I've been feeling bright and open.", axis: 'outlook', direction: 1 },
      { id: 'nc-3', text: 'I feel cool-headed rather than fired up.', axis: 'warmth', direction: -1 },
    ],
    next: 'final',
    buttonLabel: 'Show my final stretch',
  },
  'american-wing': {
    id: 'american-wing',
    name: 'The American Wing',
    about:
      'Big skies, wide rivers and people in the middle of deciding something. These paintings are about distance and where you are heading.',
    statements: [
      { id: 'aw-1', text: 'I feel pointed at something right now.', axis: 'focus', direction: -1 },
      { id: 'aw-2', text: 'I need some room to breathe.', axis: 'outlook', direction: 1 },
      { id: 'aw-3', text: "I've been keeping things to myself.", axis: 'focus', direction: 1 },
    ],
    next: 'final',
    buttonLabel: 'Show my final stretch',
  },
}

export const START_ROOM: RoomId = 'great-hall'

export const doors: Door[] = [
  {
    roomId: 'european-paintings',
    reason: 'For a mind that is busy but wants to land somewhere warm.',
    affinity: { energy: 0.4, warmth: 0.6, outlook: 0, focus: 0.4 },
  },
  {
    roomId: 'nineteenth-century',
    reason: 'For a day that should move a little slower.',
    affinity: { energy: -0.7, warmth: -0.2, outlook: 0.4, focus: 0.1 },
  },
  {
    roomId: 'american-wing',
    reason: 'For when you want space, or a direction.',
    affinity: { energy: 0.3, warmth: 0, outlook: 0.5, focus: -0.7 },
  },
]

export const WALK_SUMMARY = {
  rooms: 2,
  statements: 6,
  minutes: 2,
}
