import type { Room, RoomId } from './types'

export const MUSEUM = {
  id: 'met',
  name: 'The Met Fifth Avenue',
  shortName: 'The Met',
  city: 'New York',
  works: '490,000 works',
  nearby: [
    { name: 'MoMA', city: 'New York' },
    { name: 'Guggenheim', city: 'New York' },
    { name: 'Brooklyn Museum', city: 'Brooklyn' },
  ],
}

export const START_ROOM: RoomId = 'great-hall'

const v = (energy: number, warmth: number, outlook: number, focus: number, social: number) => ({
  energy,
  warmth,
  outlook,
  focus,
  social,
})

export const rooms: Record<RoomId, Room> = {
  'great-hall': {
    id: 'great-hall',
    name: 'The Great Hall',
    floor: 1,
    planKey: 'hall',
    about:
      "Every walk starts here, under the domes of The Met's front hall. Take a breath. Tell us how you're arriving today.",
    statements: [
      { id: 'gh-1', text: 'My mind has been racing lately.', axis: 'energy', direction: 1 },
      {
        id: 'gh-2',
        text: "Right now I'm drawn more to warm sunlight than cool rain.",
        axis: 'warmth',
        direction: 1,
      },
      {
        id: 'gh-3',
        text: "I'd rather be somewhere quiet than somewhere lively right now.",
        axis: 'social',
        direction: -1,
      },
    ],
    affinity: v(0, 0, 0, 0, 0),
    reason: 'Where every walk begins.',
    shortReason: 'Where every walk begins.',
    department: 'Entrance',
    departmentId: 0,
    galleries: 'Entrance',
  },
  'european-paintings': {
    id: 'european-paintings',
    name: 'European Paintings',
    floor: 2,
    planKey: 'eurp',
    about:
      'Portraits, saints and stormy seas from 1250 to 1800. These painters used light to show what people were feeling.',
    statements: [
      { id: 'ep-1', text: 'Something has been weighing on me this week.', axis: 'outlook', direction: -1 },
      { id: 'ep-2', text: "I'm excited about something coming up.", axis: 'outlook', direction: 1 },
      { id: 'ep-3', text: "I've been feeling close to the people around me.", axis: 'social', direction: 1 },
    ],
    affinity: v(0.4, 0.6, 0, 0.4, 0.1),
    reason: 'For warm but restless days. Five centuries of faces, saints and golden light.',
    shortReason: 'For warm, searching days.',
    department: 'European Paintings',
    departmentId: 11,
    galleries: '600s to 640s',
  },
  'nineteenth-century': {
    id: 'nineteenth-century',
    name: '19th-Century European Paintings',
    floor: 2,
    planKey: 'c19',
    about:
      'Light, weather and ordinary afternoons, painted fast and outdoors. The Impressionists cared more about how a moment felt than how it looked.',
    statements: [
      { id: 'nc-1', text: 'I want the day to slow down.', axis: 'energy', direction: -1 },
      { id: 'nc-2', text: "I've been feeling bright and open.", axis: 'outlook', direction: 1 },
      { id: 'nc-3', text: 'I feel cool-headed rather than fired up.', axis: 'warmth', direction: -1 },
    ],
    affinity: v(-0.5, -0.1, 0.5, 0, 0.2),
    reason: 'For a day that should move a little slower. Light, weather and ordinary afternoons.',
    shortReason: 'For slower, brighter days.',
    department: 'European Paintings',
    departmentId: 11,
    galleries: '800s to 830s',
  },
  'american-wing': {
    id: 'american-wing',
    name: 'The American Wing',
    floor: 2,
    planKey: 'amer',
    about:
      'Big skies, wide rivers and people in the middle of deciding something. These paintings are about distance and where you are heading.',
    statements: [
      { id: 'aw-1', text: 'I feel pointed at something right now.', axis: 'focus', direction: -1 },
      { id: 'aw-2', text: 'I need some room to breathe.', axis: 'outlook', direction: 1 },
      { id: 'aw-3', text: "I've been keeping things to myself.", axis: 'focus', direction: 1 },
    ],
    affinity: v(0.3, 0, 0.5, -0.6, 0),
    reason: 'For when you want space, or a direction. Big skies, wide rivers and long views.',
    shortReason: 'For when you need room to breathe.',
    department: 'The American Wing',
    departmentId: 1,
    galleries: '740s to 760s',
  },
  'arms-and-armor': {
    id: 'arms-and-armor',
    name: 'Arms and Armor',
    floor: 1,
    planKey: 'arms',
    about:
      'A court of knights on horseback, parade armor and swords made to be looked at more than used. Loud, shiny and built for a crowd.',
    statements: [
      { id: 'aa-1', text: "I've got energy to burn today.", axis: 'energy', direction: 1 },
      { id: 'aa-2', text: "I'm in the mood for company and a bit of noise.", axis: 'social', direction: 1 },
      { id: 'aa-3', text: 'I feel ready to take something on.', axis: 'outlook', direction: 1 },
    ],
    affinity: v(0.8, 0.2, 0.2, -0.3, 0.6),
    reason: 'For loud, high-energy days. Steel, horses and armor made to turn heads.',
    shortReason: 'For loud, high-energy days.',
    department: 'Arms and Armor',
    departmentId: 4,
    galleries: '370s',
  },
  'egyptian-art': {
    id: 'egyptian-art',
    name: 'Egyptian Art',
    floor: 1,
    planKey: 'egypt',
    about:
      'Four thousand years of stone, sand and small carved faces, ending at a whole temple beside a pool of water. The quietest wing in the building.',
    statements: [
      { id: 'eg-1', text: "I'd like everything to slow down for a while.", axis: 'energy', direction: -1 },
      { id: 'eg-2', text: "I've been thinking about the past more than usual.", axis: 'focus', direction: 1 },
      { id: 'eg-3', text: "I'd rather be on my own right now.", axis: 'social', direction: -1 },
    ],
    affinity: v(-0.7, -0.3, -0.3, 0.3, -0.6),
    reason: 'For days when you need quiet. Stone, sand and a temple by the water.',
    shortReason: 'For days when you need quiet.',
    department: 'Egyptian Art',
    departmentId: 10,
    galleries: '100s to 130s',
  },
  'asian-art': {
    id: 'asian-art',
    name: 'Asian Art',
    floor: 2,
    planKey: 'asian',
    about:
      'Scrolls, screens and a courtyard garden with its own weather. A lot of these works are mostly empty space on purpose.',
    statements: [
      { id: 'as-1', text: 'I could use some stillness.', axis: 'energy', direction: -1 },
      { id: 'as-2', text: "I've been noticing small things lately.", axis: 'focus', direction: 1 },
      { id: 'as-3', text: 'I feel more cool and clear than fired up.', axis: 'warmth', direction: -1 },
    ],
    affinity: v(-0.6, -0.2, 0.2, 0.6, -0.3),
    reason: 'For turning inward. Scrolls, gardens and a lot of room to think.',
    shortReason: 'For turning inward.',
    department: 'Asian Art',
    departmentId: 6,
    galleries: '200s',
  },
  'greek-and-roman': {
    id: 'greek-and-roman',
    name: 'Greek and Roman Art',
    floor: 1,
    planKey: 'greek',
    about:
      'A sunlit court of marble bodies, painted vases and faces that look oddly like people you know. Two thousand years old and not shy about it.',
    statements: [
      { id: 'gr-1', text: 'I want something clear and simple today.', axis: 'warmth', direction: -1 },
      { id: 'gr-2', text: 'I feel steady on my feet right now.', axis: 'energy', direction: -1 },
      { id: 'gr-3', text: "I'd like to be where other people are.", axis: 'social', direction: 1 },
    ],
    affinity: v(-0.2, -0.5, 0.4, -0.4, 0.5),
    reason: 'For clear heads and long views. Marble, sunlight and a very big room.',
    shortReason: 'For clear, steady days.',
    department: 'Greek and Roman Art',
    departmentId: 13,
    galleries: '150s to 160s',
  },
}

export const ROOM_IDS = Object.keys(rooms) as RoomId[]

/** Rooms you can walk into from the Great Hall. */
export const DOOR_ROOMS: RoomId[] = ROOM_IDS.filter((id) => id !== START_ROOM)

export function isRoomId(id: string | undefined): id is RoomId {
  return !!id && id in rooms
}
