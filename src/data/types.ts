export type Axis = 'energy' | 'warmth' | 'outlook' | 'focus'

export type MoodVector = Record<Axis, number>

export type RoomId = 'great-hall' | 'european-paintings' | 'nineteenth-century' | 'american-wing'

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
  /** Shown in the "About this room" card. */
  about: string
  statements: Statement[]
  /** Where the primary button goes after this room. */
  next: 'doors' | 'final'
  buttonLabel: string
}

export interface Door {
  roomId: RoomId
  reason: string
  /** Door affinity in mood space, used to recommend one of the three. */
  affinity: MoodVector
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
  approachVia: string
  mood: MoodVector
  tags: string[]
  why: string
}

/** 1 = strongly agree ... 7 = strongly disagree, matching the 7-dot scale. */
export type Answer = 1 | 2 | 3 | 4 | 5 | 6 | 7
