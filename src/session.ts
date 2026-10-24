import { CONFUSING_GROUPS, idsForSets, type SetKey } from './kana'

export type Direction = 'k2r' | 'r2k'

export interface Session {
  id: string
  setKeys: SetKey[]
  direction: Direction
  itemIds: string[]
  /** Look-alike groups (2+ members) that must stay adjacent */
  groups: string[][]
  /** Round 0 is the preview pass */
  round: number
  /** Kana still on the grid, in display order */
  remaining: string[]
  /** Kana revealed this round; they stay for the next round unless erased */
  seen: string[]
  removedAt: Record<string, number>
  /** Erasures of this round, newest last, for undo */
  undo: { id: string; index: number; seen?: boolean }[]
  elapsedMs: number
  resumedAt: number | null
  reviewOf?: string
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Split ids into display units: a look-alike group becomes one unit. */
export function toUnits(ids: string[], groups: string[][], shuffled = false): string[][] {
  const groupOf = new Map<string, number>()
  groups.forEach((g, i) => g.forEach((id) => groupOf.set(id, i)))
  const units: string[][] = []
  const byGroup = new Map<number, string[]>()
  for (const id of ids) {
    const gi = groupOf.get(id)
    if (gi === undefined) {
      units.push([id])
      continue
    }
    let unit = byGroup.get(gi)
    if (!unit) {
      unit = []
      byGroup.set(gi, unit)
      units.push(unit)
    }
    unit.push(id)
  }
  if (shuffled) {
    shuffle(units)
    units.forEach((u) => shuffle(u))
  }
  return units
}

export function createSession(
  setKeys: SetKey[],
  direction: Direction,
  opts: { itemIds?: string[]; reviewOf?: string } = {},
): Session {
  const itemIds = opts.itemIds ?? idsForSets(setKeys)
  const present = new Set(itemIds)
  const groups = setKeys.includes('confusing')
    ? CONFUSING_GROUPS.map((g) => g.filter((id) => present.has(id))).filter((g) => g.length > 1)
    : []
  return {
    id: Math.random().toString(36).slice(2),
    setKeys,
    direction,
    itemIds,
    groups,
    round: 0,
    remaining: toUnits(itemIds, groups).flat(),
    seen: [],
    removedAt: {},
    undo: [],
    elapsedMs: 0,
    resumedAt: null,
    reviewOf: opts.reviewOf,
  }
}

export type Action =
  | { type: 'load'; session: Session | null }
  | { type: 'nextRound' }
  | { type: 'reveal'; id: string }
  | { type: 'erase'; id: string }
  | { type: 'undo' }
  | { type: 'pause' }
  | { type: 'resume' }

export function elapsed(s: Session, now = Date.now()): number {
  return s.elapsedMs + (s.resumedAt ? now - s.resumedAt : 0)
}

export function reducer(s: Session | null, a: Action): Session | null {
  if (a.type === 'load') return a.session
  if (!s) return s
  switch (a.type) {
    case 'nextRound':
      return {
        ...s,
        round: s.round + 1,
        remaining: toUnits(s.remaining, s.groups, true).flat(),
        seen: [],
        undo: [],
        resumedAt: s.resumedAt ?? Date.now(),
      }
    case 'reveal':
      if (s.round === 0 || s.seen.includes(a.id)) return s
      return { ...s, seen: [...s.seen, a.id] }
    case 'erase': {
      const index = s.remaining.indexOf(a.id)
      if (s.round === 0 || index < 0) return s
      const seen = s.seen.includes(a.id)
      return {
        ...s,
        remaining: s.remaining.filter((id) => id !== a.id),
        seen: seen ? s.seen.filter((id) => id !== a.id) : s.seen,
        removedAt: { ...s.removedAt, [a.id]: s.round },
        undo: [...s.undo, { id: a.id, index, seen }],
      }
    }
    case 'undo': {
      const last = s.undo[s.undo.length - 1]
      if (!last) return s
      const remaining = [...s.remaining]
      remaining.splice(last.index, 0, last.id)
      const removedAt = { ...s.removedAt }
      delete removedAt[last.id]
      return {
        ...s,
        remaining,
        removedAt,
        seen: last.seen ? [...s.seen, last.id] : s.seen,
        undo: s.undo.slice(0, -1),
      }
    }
    case 'pause':
      if (!s.resumedAt) return s
      return { ...s, elapsedMs: elapsed(s), resumedAt: null }
    case 'resume':
      if (s.resumedAt || s.round === 0) return s
      return { ...s, resumedAt: Date.now() }
  }
}
