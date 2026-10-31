import { useRef, useState, type Dispatch } from 'react'
import { KANA } from '../kana'
import { toUnits, type Action, type Session } from '../session'

interface Props {
  session: Session
  dispatch: Dispatch<Action>
  onExit: () => void
}

const SWIPE_PX = 64
const TAP_SLOP = 10
const LEAVE_MS = 160

export default function Study({ session, dispatch, onExit }: Props) {
  const { round, remaining, passed, itemIds, seen, direction } = session
  const preview = round === 0
  const total = itemIds.length
  const units = toUnits(remaining, session.groups)
  const k2r = direction === 'k2r'

  const erase = (id: string) => {
    if (preview) return
    navigator.vibrate?.(8)
    dispatch({ type: 'erase', id })
  }
  const pass = (id: string) => {
    if (preview) return
    navigator.vibrate?.(8)
    dispatch({ type: 'pass', id })
  }
  const tap = (id: string) => {
    if (preview) return
    dispatch({ type: 'reveal', id })
  }

  const left = remaining.length + passed.length
  const progress = (total - left) / total

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
                <strong>{round}회차</strong> · 남은 <strong>{left}</strong> / 전체 {total}
                {passed.length > 0 && <span className="passed-count"> · 모름 {passed.length}</span>}
              </>
            )}
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={total - left}
          >
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </header>

      <p className="study-hint">
        {preview
          ? '정답을 보면서 한 번 훑어보세요.'
          : '탭: 정답 보기 · 알면 → 밀기 · 모르면 ← 밀기(다음 회차에 다시)'}
      </p>

      <main className="list">
        {units.map((unit) => {
          const rows = unit.map((id) => (
            <Row
              key={id}
              id={id}
              k2r={k2r}
              state={preview ? 'preview' : seen.includes(id) ? 'seen' : 'hidden'}
              swipeable={!preview}
              onTap={() => tap(id)}
              onErase={() => erase(id)}
              onPass={() => pass(id)}
            />
          ))
          if (unit.length === 1) return rows
          return (
            <div key={unit.join('')} className="unit">
              {rows}
            </div>
          )
        })}
      </main>

      <footer className="bar">
        {preview ? (
          <button className="btn primary big" onClick={() => dispatch({ type: 'nextRound' })}>
            시작
          </button>
        ) : (
          <button
            className="btn undo grow"
            disabled={session.undo.length === 0}
            onClick={() => dispatch({ type: 'undo' })}
            aria-label="마지막으로 민 글자 되돌리기"
          >
            ↶ 되돌리기
          </button>
        )}
      </footer>
    </div>
  )
}

interface RowProps {
  id: string
  k2r: boolean
  state: 'preview' | 'hidden' | 'seen'
  swipeable: boolean
  onTap: () => void
  onErase: () => void
  onPass: () => void
}

function Row({ id, k2r, state, swipeable, onTap, onErase, onPass }: RowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const [dx, setDx] = useState(0)
  const [leaving, setLeaving] = useState<'right' | 'left' | null>(null)

  const kana = KANA[id]
  const face = k2r ? kana.kana : kana.romaji
  const answer = k2r ? kana.romaji : kana.kana
  const showAnswer = state !== 'hidden'

  const reset = () => {
    start.current = null
    setDx(0)
  }

  // Slide the row off screen, then remove it.
  const leave = (dir: 'right' | 'left') => {
    setLeaving(dir)
    setTimeout(dir === 'right' ? onErase : onPass, LEAVE_MS)
  }

  const armed = dx > SWIPE_PX ? 'right' : dx < -SWIPE_PX ? 'left' : null
  const style = leaving
    ? { transform: `translateX(${leaving === 'right' ? 110 : -110}%)`, opacity: 0 }
    : dx
      ? { transform: `translateX(${dx}px)`, transition: 'none' }
      : undefined

  return (
    <div className={`row-wrap ${armed ?? leaving ?? ''}`}>
      {swipeable && (
        <div className="swipe-bg" aria-hidden="true">
          <span className="swipe-know">✓ 알아요</span>
          <span className="swipe-pass">몰라요 ↺</span>
        </div>
      )}
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label={showAnswer ? `${face}, 정답 ${answer}` : `${face}, 정답 가려짐`}
        className={`item ${state}`}
        style={style}
        onPointerDown={(e) => {
          if (!swipeable || leaving) return
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
          // Keep receiving the pointer even if a fast swipe ends over another row.
          ref.current?.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s || s.id !== e.pointerId) return
          const mx = e.clientX - s.x
          const my = e.clientY - s.y
          if (Math.abs(mx) > TAP_SLOP && Math.abs(mx) > Math.abs(my)) setDx(mx)
          else if (dx) setDx(0)
        }}
        onPointerUp={(e) => {
          const s = start.current
          if (!s) return
          const mx = e.clientX - s.x
          const my = e.clientY - s.y
          reset()
          if (Math.abs(mx) > SWIPE_PX && Math.abs(mx) > Math.abs(my)) {
            leave(mx > 0 ? 'right' : 'left')
          } else if (Math.abs(mx) < TAP_SLOP && Math.abs(my) < TAP_SLOP) {
            onTap()
          }
        }}
        onPointerCancel={reset}
        onKeyDown={(e) => {
          if (!swipeable || leaving) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onTap()
          } else if (e.key === 'ArrowRight' || e.key === 'Delete' || e.key === 'Backspace') {
            leave('right')
          } else if (e.key === 'ArrowLeft') {
            leave('left')
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
    </div>
  )
}
