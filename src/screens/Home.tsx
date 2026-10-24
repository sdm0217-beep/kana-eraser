import { useMemo } from 'react'
import { KANA, SET_IDS, SETS, idsForSets, type SetKey } from '../kana'
import type { Direction, Session } from '../session'
import {
  findReview,
  loadCompletions,
  loadStats,
  type Prefs,
  type ReviewOffer,
  type Theme,
} from '../storage'

interface Props {
  prefs: Prefs
  setPrefs: (p: Prefs) => void
  session: Session | null
  onStart: (keys: SetKey[], dir: Direction) => void
  onContinue: () => void
  onDiscard: () => void
  onReview: (r: ReviewOffer) => void
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: '자동' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
]

export default function Home({
  prefs,
  setPrefs,
  session,
  onStart,
  onContinue,
  onDiscard,
  onReview,
}: Props) {
  const review = useMemo(() => findReview(loadCompletions()), [])
  const stubborn = useMemo(() => {
    const stats = loadStats()
    return Object.entries(stats)
      .filter(([id]) => KANA[id])
      .map(([id, s]) => ({ id, avg: s.totalRounds / s.plays, max: s.maxRound }))
      .sort((a, b) => b.avg - a.avg || b.max - a.max)
      .slice(0, 8)
  }, [])

  const count = idsForSets(prefs.setKeys).length
  const toggle = (key: SetKey) => {
    const has = prefs.setKeys.includes(key)
    setPrefs({
      ...prefs,
      setKeys: has ? prefs.setKeys.filter((k) => k !== key) : [...prefs.setKeys, key],
    })
  }

  const groups = ['히라가나', '가타카나', '혼합'] as const

  return (
    <div className="page home">
      <header className="home-head">
        <div>
          <h1>
            가나 <span className="accent">지우기</span>
          </h1>
          <p className="muted">아는 글자를 지워가며 반복하는 암기법</p>
        </div>
        <div className="seg small" role="radiogroup" aria-label="테마">
          {THEMES.map((t) => (
            <button
              key={t.value}
              role="radio"
              aria-checked={prefs.theme === t.value}
              className={prefs.theme === t.value ? 'on' : ''}
              onClick={() => setPrefs({ ...prefs, theme: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {session && (
        <section className="card resume">
          <div>
            <strong>
              {session.round === 0 ? '훑어보기' : `${session.round}회차`} 진행 중
            </strong>
            <span className="muted">
              {' '}
              · 남은 {session.remaining.length} / 전체 {session.itemIds.length}
            </span>
          </div>
          <div className="row">
            <button className="btn primary" onClick={onContinue}>
              이어하기
            </button>
            <button className="btn ghost" onClick={onDiscard}>
              버리기
            </button>
          </div>
        </section>
      )}

      {review && (
        <button className="btn review" onClick={() => onReview(review)}>
          <span className="review-title">{review.label}</span>
          <span className="review-sub">{review.itemIds.length}자 다시 깔기</span>
        </button>
      )}

      <section className="card">
        <h2>세트</h2>
        {groups.map((g) => (
          <div key={g} className="set-group">
            <div className="set-label">{g}</div>
            <div className="chips">
              {SETS.filter((s) => s.script === g).map((s) => {
                const on = prefs.setKeys.includes(s.key)
                return (
                  <button
                    key={s.key}
                    className={`chip ${on ? 'on' : ''} ${s.key === 'confusing' ? 'purple' : ''}`}
                    aria-pressed={on}
                    onClick={() => toggle(s.key)}
                  >
                    <span className="chip-sample" lang="ja">
                      {SET_IDS[s.key].slice(0, s.key === 'confusing' ? 2 : 3).join('')}
                    </span>
                    {s.label}
                    <span className="chip-count">{SET_IDS[s.key].length}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {prefs.setKeys.includes('confusing') && (
          <p className="hint">헷갈리는 쌍은 그리드에서 항상 붙어서 나와요.</p>
        )}
      </section>

      <section className="card">
        <h2>방향</h2>
        <div className="seg" role="radiogroup" aria-label="방향">
          {(
            [
              ['k2r', '가나 → 로마자'],
              ['r2k', '로마자 → 가나'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="radio"
              aria-checked={prefs.direction === value}
              className={prefs.direction === value ? 'on' : ''}
              onClick={() => setPrefs({ ...prefs, direction: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {stubborn.length > 0 && (
        <section className="card">
          <h2>끈질긴 글자</h2>
          <p className="muted small-text">평균적으로 가장 늦게 지워진 글자</p>
          <div className="stubborn">
            {stubborn.map((s) => (
              <div key={s.id} className="stubborn-item">
                <span className="kana" lang="ja">
                  {s.id}
                </span>
                <span className="muted">{KANA[s.id].romaji}</span>
                <span className="badge yellow">{s.avg.toFixed(1)}회</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="spacer" />
      <footer className="bar">
        <button
          className="btn primary big"
          disabled={count === 0}
          onClick={() => onStart(prefs.setKeys, prefs.direction)}
        >
          {count === 0 ? '세트를 골라주세요' : `${count}자 시작`}
        </button>
      </footer>
    </div>
  )
}
