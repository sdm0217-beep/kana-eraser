import { useEffect, useRef, useState, type Dispatch } from 'react'
import { KANA } from '../kana'
import { toUnits, type Action, type Session } from '../session'

interface Props {
  session: Session
  dispatch: Dispatch<Action>
  onExit: () => void
}

const SWIPE_PX = 48
const TAP_SLOP = 10

export default function Study({ session, dispatch, onExit }: Props) {
  const [eraseMode, setEraseMode] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const { round, remaining, itemIds, seen, direction } = session
  const preview = round === 0
  const total = itemIds.length
  const units = toUnits(remaining, session.groups)
  const k2r = direction === 'k2r'
  const wide = remaining.some((id) => (k2r ? id.length > 1 : KANA[id].romaji.length > 2))
  const allSeen = !preview && remaining.length > 0 && remaining.every((id) => seen.includes(id))

  const say = (msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 1600)
  }
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const erase = (id: string) => {
    if (seen.includes(id)) {
      say('본 글자는 이번 회차에 못 지워요')
      return
    }
    navigator.vibrate?.(8)
    dispatch({ type: 'erase', id })
  }
  const tap = (id: string) => {
    if (preview) return
    if (eraseMode) erase(id)
    else dispatch({ type: 'reveal', id })
  }

  const progress = (total - remaining.length) / total

  return (
    <div className="page study">
      <header className="study-head">
        <button className="icon-btn" aria-label="처음으로" onClick={onExit}>
          ←
        </button>
        <div className="study-title">
          <div className="round-line">
            {preview ? (
              <>
                <strong>훑어보기</strong> · 전체 {total}
              </>
            ) : (
              <>
                <strong>{round}회차</strong> · 남은 <strong>{remaining.length}</strong> / 전체{' '}
                {total}
              </>
            )}
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={total - remaining.length}
          >
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </header>

      <p className="study-hint">
        {preview
          ? '정답을 보면서 한 번 훑어보세요.'
          : eraseMode
            ? '지우기 모드: 탭하면 지워져요.'
            : '탭: 정답 보기 · 옆으로 밀기: 알아(지우기)'}
      </p>

      <main className={`grid ${wide ? 'wide' : ''}`}>
        {units.map((unit) => {
          const cells = unit.map((id) => (
            <Cell
              key={id}
              id={id}
              k2r={k2r}
              state={preview ? 'preview' : seen.includes(id) ? 'seen' : 'hidden'}
              grouped={unit.length > 1}
              onTap={() => tap(id)}
              onSwipe={() => !preview && erase(id)}
            />
          ))
          if (unit.length === 1) return cells
          return (
            <div
              key={unit.join('')}
              className="unit"
              style={{
                gridColumn: `span ${unit.length}`,
                gridTemplateColumns: `repeat(${unit.length}, 1fr)`,
              }}
            >
              {cells}
            </div>
          )
        })}
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      <footer className="bar">
        {preview ? (
          <button className="btn primary big" onClick={() => dispatch({ type: 'nextRound' })}>
            시작
          </button>
        ) : (
          <>
            <button
              className="btn undo"
              disabled={session.undo.length === 0}
              onClick={() => dispatch({ type: 'undo' })}
              aria-label="마지막 지우기 되돌리기"
            >
              ↶ 되돌리기
            </button>
            <button
              className={`btn erase-toggle ${eraseMode ? 'on' : ''}`}
              aria-pressed={eraseMode}
              onClick={() => setEraseMode((m) => !m)}
            >
              ✓ 지우기
            </button>
            <button
              className={`btn primary grow ${allSeen ? 'pulse' : ''}`}
              onClick={() => {
                setEraseMode(false)
                dispatch({ type: 'nextRound' })
              }}
            >
              다음 회차 →
            </button>
          </>
        )}
      </footer>
    </div>
  )
}

interface CellProps {
  id: string
  k2r: boolean
  state: 'preview' | 'hidden' | 'seen'
  grouped: boolean
  onTap: () => void
  onSwipe: () => void
}

function Cell({ id, k2r, state, grouped, onTap, onSwipe }: CellProps) {
  const ref = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const [dx, setDx] = useState(0)

  const kana = KANA[id]
  const face = k2r ? kana.kana : kana.romaji
  const answer = k2r ? kana.romaji : kana.kana
  const showAnswer = state !== 'hidden'

  const reset = () => {
    start.current = null
    setDx(0)
  }

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={showAnswer ? `${face}, 정답 ${answer}` : `${face}, 정답 가려짐`}
      className={`cell ${state} ${grouped ? 'grouped' : ''} ${Math.abs(dx) > SWIPE_PX ? 'armed' : ''}`}
      style={dx ? { transform: `translateX(${dx}px)`, opacity: 1 - Math.min(Math.abs(dx) / 160, 0.6) } : undefined}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
        // Keep receiving the pointer even if a fast swipe ends over another cell.
        ref.current?.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const s = start.current
        if (!s || s.id !== e.pointerId) return
        const mx = e.clientX - s.x
        const my = e.clientY - s.y
        if (Math.abs(mx) > TAP_SLOP && Math.abs(mx) > Math.abs(my)) {
          ref.current?.setPointerCapture(e.pointerId)
          setDx(mx)
        }
      }}
      onPointerUp={(e) => {
        const s = start.current
        if (!s) return
        const mx = e.clientX - s.x
        const my = e.clientY - s.y
        reset()
        if (Math.abs(mx) > SWIPE_PX && Math.abs(mx) > Math.abs(my)) onSwipe()
        else if (Math.abs(mx) < TAP_SLOP && Math.abs(my) < TAP_SLOP) onTap()
      }}
      onPointerCancel={reset}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTap()
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          onSwipe()
        }
      }}
    >
      <span className={`face ${k2r ? 'kana' : 'romaji'}`} lang={k2r ? 'ja' : undefined}>
        {face}
      </span>
      <span className={`answer ${k2r ? 'romaji' : 'kana'}`} lang={k2r ? undefined : 'ja'}>
        {showAnswer ? answer : '?'}
      </span>
    </div>
  )
}
