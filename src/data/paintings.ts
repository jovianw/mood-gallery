import data from './paintings.json'
import type { Painting } from './types'

export const paintings = data as unknown as Painting[]
