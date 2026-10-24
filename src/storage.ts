import type { SetKey } from './kana'
import type { Direction, Session } from './session'

const KEYS = {
  session: 'kana-eraser.session.v1',
  stats: 'kana-eraser.stats.v1',
  completions: 'kana-eraser.completions.v1',
  prefs: 'kana-eraser.prefs.v1',
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full or blocked: the app keeps working in memory
  }
}

export type Theme = 'system' | 'light' | 'dark'

export interface Prefs {
  setKeys: SetKey[]
  direction: Direction
  theme: Theme
}

/** Per-kana record of how many rounds it survived before being erased. */
export interface KanaStat {
  plays: number
  totalRounds: number
  maxRound: number
}

export interface Completion {
  id: string
  /** Local date, YYYY-MM-DD */
  date: string
  setKeys: SetKey[]
  direction: Direction
  itemIds: string[]
  rounds: number
  durationMs: number
  finishedAt: number
  /** Round in which each kana was erased */
  removedAt: Record<string, number>
  /** Date of the completions this run reviewed, if it was a review */
  reviewOf?: string
}

export const loadPrefs = (): Prefs =>
  read<Prefs>(KEYS.prefs, { setKeys: ['hira'], direction: 'k2r', theme: 'system' })
export const savePrefs = (p: Prefs) => write(KEYS.prefs, p)

export const loadSession = () => read<Session | null>(KEYS.session, null)
export const saveSession = (s: Session | null) => write(KEYS.session, s)

export const loadStats = () => read<Record<string, KanaStat>>(KEYS.stats, {})
export const loadCompletions = () => read<Completion[]>(KEYS.completions, [])

export function recordCompletion(c: Completion) {
  const list = loadCompletions()
  list.push(c)
  write(KEYS.completions, list.slice(-200))

  const stats = loadStats()
  for (const id of c.itemIds) {
    const round = c.removedAt[id] ?? c.rounds
    const s = stats[id] ?? { plays: 0, totalRounds: 0, maxRound: 0 }
    s.plays += 1
    s.totalRounds += round
    s.maxRound = Math.max(s.maxRound, round)
    stats[id] = s
  }
  write(KEYS.stats, stats)
}

export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export interface ReviewOffer {
  date: string
  label: string
  itemIds: string[]
  setKeys: SetKey[]
  direction: Direction
}

/** Kana erased on the most recent earlier day, unless already reviewed today. */
export function findReview(completions: Completion[]): ReviewOffer | null {
  const today = localDate()
  const past = completions.filter((c) => c.date < today)
  if (past.length === 0) return null
  const date = past.reduce((max, c) => (c.date > max ? c.date : max), past[0].date)
  if (completions.some((c) => c.date === today && c.reviewOf === date)) return null

  const ofDay = past.filter((c) => c.date === date)
  const ids = new Set<string>()
  const keys = new Set<SetKey>()
  for (const c of ofDay) {
    c.itemIds.forEach((id) => ids.add(id))
    c.setKeys.forEach((k) => keys.add(k))
  }
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const [, m, d] = date.split('-').map(Number)
  const label = date === localDate(yesterday) ? '어제 지운 것 복습' : `${m}/${d}에 지운 것 복습`
  return {
    date,
    label,
    itemIds: [...ids],
    setKeys: [...keys],
    direction: ofDay[ofDay.length - 1].direction,
  }
}
