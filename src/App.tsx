import { useEffect, useReducer, useState } from 'react'
import type { SetKey } from './kana'
import { createSession, elapsed, reducer, type Direction, type Session } from './session'
import {
  loadPrefs,
  loadSession,
  localDate,
  recordCompletion,
  savePrefs,
  saveSession,
  type Completion,
  type ReviewOffer,
} from './storage'
import Home from './screens/Home'
import Study from './screens/Study'
import Done from './screens/Done'

type Screen = 'home' | 'study' | 'done'

function initSession(): Session | null {
  const s = loadSession()
  // Time while the app was closed doesn't count. Sessions saved before v2.0 have no `passed`.
  return s ? { ...s, passed: s.passed ?? [], resumedAt: null } : null
}

export default function App() {
  const [prefs, setPrefs] = useState(loadPrefs)
  const [session, dispatch] = useReducer(reducer, null, initSession)
  const [screen, setScreen] = useState<Screen>('home')
  const [done, setDone] = useState<Completion | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen, session?.round])
  useEffect(() => {
    savePrefs(prefs)
  }, [prefs])
  useEffect(() => {
    saveSession(session)
  }, [session])

  useEffect(() => {
    const root = document.documentElement
    if (prefs.theme === 'system') delete root.dataset.theme
    else root.dataset.theme = prefs.theme
  }, [prefs.theme])

  // Pause the clock while the app is in the background.
  useEffect(() => {
    if (screen !== 'study') return
    dispatch({ type: 'resume' })
    const onVis = () => dispatch({ type: document.hidden ? 'pause' : 'resume' })
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      dispatch({ type: 'pause' })
    }
  }, [screen])

  useEffect(() => {
    if (
      !session ||
      session.round === 0 ||
      session.remaining.length > 0 ||
      session.passed.length > 0
    )
      return
    const c: Completion = {
      id: session.id,
      date: localDate(),
      setKeys: session.setKeys,
      direction: session.direction,
      itemIds: session.itemIds,
      rounds: session.round,
      durationMs: elapsed(session),
      finishedAt: Date.now(),
      removedAt: session.removedAt,
      reviewOf: session.reviewOf,
    }
    recordCompletion(c)
    setDone(c)
    dispatch({ type: 'load', session: null })
    setScreen('done')
  }, [session])

  const begin = (s: Session) => {
    dispatch({ type: 'load', session: s })
    setScreen('study')
  }

  if (screen === 'study' && session) {
    return <Study session={session} dispatch={dispatch} onExit={() => setScreen('home')} />
  }

  if (screen === 'done' && done) {
    return (
      <Done
        completion={done}
        onAgain={() =>
          begin(createSession(done.setKeys, done.direction, { itemIds: done.itemIds }))
        }
        onHome={() => setScreen('home')}
      />
    )
  }

  return (
    <Home
      prefs={prefs}
      setPrefs={setPrefs}
      session={session}
      onStart={(keys: SetKey[], dir: Direction) => begin(createSession(keys, dir))}
      onContinue={() => setScreen('study')}
      onDiscard={() => dispatch({ type: 'load', session: null })}
      onReview={(r: ReviewOffer) =>
        begin(createSession(r.setKeys, r.direction, { itemIds: r.itemIds, reviewOf: r.date }))
      }
    />
  )
}
