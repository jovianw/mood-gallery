import affinityData from './rooms-affinity.json'
import type { MoodVector, Room, RoomId } from './types'

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

/** Mean mood vector of each room's works, written by scripts/factor.py. */
const AFFINITY = affinityData as Record<string, MoodVector>
const affinityOf = (id: RoomId): MoodVector => AFFINITY[id] ?? {}

export const rooms: Record<RoomId, Room> = {
  'great-hall': {
    id: 'great-hall',
    name: 'The Great Hall',
    floor: 1,
    planKey: 'hall',
    about:
      "Every walk starts here, under the domes of The Met's front hall. Take a breath. Tell us how you're arriving today.",
    statements: [
      { id: 'gh-1', text: 'I\'d like everything to slow down for a while.', axis: 'still', direction: 1 },
      { id: 'gh-2', text: 'My mind has been racing lately.', axis: 'still', direction: -1 },
      { id: 'gh-3', text: 'I\'ve been feeling warm toward the people around me.', axis: 'warmth', direction: 1 },
      { id: 'gh-4', text: 'Things have felt a little cold lately.', axis: 'warmth', direction: -1 },
      { id: 'gh-5', text: 'I feel light on my feet today.', axis: 'light', direction: 1 },
      { id: 'gh-6', text: 'Something has been weighing on me this week.', axis: 'light', direction: -1 },
      { id: 'gh-7', text: 'I\'m in the mood for something big and bold.', axis: 'grand', direction: 1 },
      { id: 'gh-8', text: 'I\'d rather keep things small and simple today.', axis: 'grand', direction: -1 },
      { id: 'gh-9', text: 'I\'ve been drifting off into daydreams.', axis: 'dreamy', direction: 1 },
      { id: 'gh-10', text: 'I\'m feeling practical and matter-of-fact.', axis: 'dreamy', direction: -1 },
      { id: 'gh-11', text: 'I\'m drawn to old, sacred things right now.', axis: 'mystery', direction: 1 },
      { id: 'gh-12', text: 'I want something fresh and of the moment.', axis: 'mystery', direction: -1 },
    ],
    affinity: affinityOf('great-hall'),
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
      { id: 'ep-1', text: 'I could sit quietly for an hour.', axis: 'still', direction: 1 },
      { id: 'ep-2', text: 'I\'m craving good company.', axis: 'warmth', direction: 1 },
      { id: 'ep-3', text: 'Today feels heavy.', axis: 'light', direction: -1 },
      { id: 'ep-4', text: 'I want to be a little awed.', axis: 'grand', direction: 1 },
      { id: 'ep-5', text: 'I\'ve been lost in thought.', axis: 'dreamy', direction: 1 },
      { id: 'ep-6', text: 'I\'m thinking about things bigger than me.', axis: 'mystery', direction: 1 },
      { id: 'ep-7', text: 'I\'d rather be in the present than the past.', axis: 'mystery', direction: -1 },
    ],
    affinity: affinityOf('european-paintings'),
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
      { id: 'nc-1', text: 'I want the day to slow down.', axis: 'still', direction: 1 },
      { id: 'nc-2', text: 'I\'ve been feeling close to people.', axis: 'warmth', direction: 1 },
      { id: 'nc-3', text: 'I\'ve been feeling bright and open.', axis: 'light', direction: 1 },
      { id: 'nc-4', text: 'I don\'t need anything grand today.', axis: 'grand', direction: -1 },
      { id: 'nc-5', text: 'I\'ve been daydreaming more than usual.', axis: 'dreamy', direction: 1 },
      { id: 'nc-6', text: 'I want something fresh and modern.', axis: 'mystery', direction: -1 },
      { id: 'nc-7', text: 'There\'s a weight I can\'t quite put down.', axis: 'light', direction: -1 },
    ],
    affinity: affinityOf('nineteenth-century'),
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
      { id: 'aw-1', text: 'I feel calm and unhurried.', axis: 'still', direction: 1 },
      { id: 'aw-2', text: 'I\'ve been feeling a little lonely.', axis: 'warmth', direction: -1 },
      { id: 'aw-3', text: 'I need some room to breathe.', axis: 'light', direction: 1 },
      { id: 'aw-4', text: 'I want wide skies and big views.', axis: 'grand', direction: 1 },
      { id: 'aw-5', text: 'I\'m keeping my feet on the ground.', axis: 'dreamy', direction: -1 },
      { id: 'aw-6', text: 'I\'d rather look forward than back.', axis: 'mystery', direction: -1 },
      { id: 'aw-7', text: 'My mood is sunny today.', axis: 'light', direction: 1 },
    ],
    affinity: affinityOf('american-wing'),
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
      { id: 'aa-1', text: 'I\'ve got energy to burn today.', axis: 'still', direction: -1 },
      { id: 'aa-2', text: 'I\'m in the mood for company and a bit of noise.', axis: 'warmth', direction: 1 },
      { id: 'aa-3', text: 'I feel sturdy and solid.', axis: 'light', direction: -1 },
      { id: 'aa-4', text: 'I feel ready to take on something big.', axis: 'grand', direction: 1 },
      { id: 'aa-5', text: 'I\'m feeling sharp and focused.', axis: 'dreamy', direction: -1 },
      { id: 'aa-6', text: 'I\'m curious about how things used to be.', axis: 'mystery', direction: 1 },
      { id: 'aa-7', text: 'I feel a bit steely today.', axis: 'warmth', direction: -1 },
    ],
    affinity: affinityOf('arms-and-armor'),
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
      { id: 'eg-1', text: 'I could use some stillness.', axis: 'still', direction: 1 },
      { id: 'eg-2', text: 'I\'d rather be on my own right now.', axis: 'warmth', direction: -1 },
      { id: 'eg-3', text: 'I\'m carrying something heavy.', axis: 'light', direction: -1 },
      { id: 'eg-4', text: 'I\'m drawn to monuments and big gestures.', axis: 'grand', direction: 1 },
      { id: 'eg-5', text: 'I\'ve been thinking about the past more than usual.', axis: 'dreamy', direction: 1 },
      { id: 'eg-6', text: 'I\'m drawn to the sacred and the very old.', axis: 'mystery', direction: 1 },
      { id: 'eg-7', text: 'I feel unburdened today.', axis: 'light', direction: 1 },
    ],
    affinity: affinityOf('egyptian-art'),
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
      { id: 'as-1', text: 'I want a quiet corner.', axis: 'still', direction: 1 },
      { id: 'as-2', text: 'I\'d like some gentle company.', axis: 'warmth', direction: 1 },
      { id: 'as-3', text: 'I feel delicate today, in a good way.', axis: 'light', direction: 1 },
      { id: 'as-4', text: 'Small and careful things suit me today.', axis: 'grand', direction: -1 },
      { id: 'as-5', text: 'I\'ve been noticing small things and drifting.', axis: 'dreamy', direction: 1 },
      { id: 'as-6', text: 'I want something with a long history behind it.', axis: 'mystery', direction: 1 },
      { id: 'as-7', text: 'I feel restless inside.', axis: 'still', direction: -1 },
    ],
    affinity: affinityOf('asian-art'),
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
      { id: 'gr-1', text: 'I feel steady on my feet right now.', axis: 'still', direction: 1 },
      { id: 'gr-2', text: 'I\'d like to be where other people are.', axis: 'warmth', direction: 1 },
      { id: 'gr-3', text: 'I want something clear and simple today.', axis: 'light', direction: 1 },
      { id: 'gr-4', text: 'I want marble and sunlight and big rooms.', axis: 'grand', direction: 1 },
      { id: 'gr-5', text: 'I\'m feeling clear-headed, not dreamy.', axis: 'dreamy', direction: -1 },
      { id: 'gr-6', text: 'I\'m curious about the ancient world.', axis: 'mystery', direction: 1 },
      { id: 'gr-7', text: 'I feel cool and composed.', axis: 'warmth', direction: -1 },
    ],
    affinity: affinityOf('greek-and-roman'),
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
