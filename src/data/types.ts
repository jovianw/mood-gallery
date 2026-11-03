export type Axis = 'energy' | 'warmth' | 'outlook' | 'focus' | 'social'

/** Each axis runs -1..1. energy restless(+)/calm(-), warmth warm/cool, outlook hopeful/heavy,
 *  focus inward/outward, social together(+)/alone(-). */
export type MoodVector = Record<Axis, number>

export type RoomId =
  | 'great-hall'
  | 'european-paintings'
  | 'nineteenth-century'
  | 'american-wing'
  | 'arms-and-armor'
  | 'egyptian-art'
  | 'asian-art'
  | 'greek-and-roman'

export interface Statement {
  id: string
  text: string
  axis: Axis
  /** +1 means "Agree" pushes the axis positive, -1 means it pushes it negative. */
  direction: 1 | -1
}

export interface Room {
  id: RoomId
  name: string
  floor: 1 | 2
  /** Key of this room's block in met_floorplan.json. */
  planKey: string
  /** Shown in the "About this room" card. */
  about: string
  statements: [Statement, Statement, Statement]
  /** Where this room sits in mood space; used to pick the three doors. */
  affinity: MoodVector
  /** Door card copy for the recommended door. */
  reason: string
  /** Door card copy for the other doors. */
  shortReason: string
  /** Met department name and id used when curating paintings. */
  department: string
  departmentId: number
  /** Human readable gallery range, e.g. "600s to 640s". */
  galleries: string
}

export interface Painting {
  objectID: number
  title: string
  artist: string
  date: string
  medium: string
  gallery: string | null
  image: string
  imageLarge: string
  objectURL: string
  room: RoomId
  /** Floor plan block the painting hangs in (e.g. "g822" or "eurp"). */
  galleryKey: string
  mood: MoodVector
  tags: string[]
  why: string
}

/** 1 = strongly agree ... 7 = strongly disagree, matching the 7-dot scale. */
export type Answer = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** One stop of a finished walk, stored with saves and shares. */
export interface RouteStop {
  roomId: RoomId
  moodPhrase: string
}
