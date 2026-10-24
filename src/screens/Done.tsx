import { KANA } from '../kana'
import type { Completion } from '../storage'

interface Props {
  completion: Completion
  onAgain: () => void
  onHome: () => void
}

function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}분 ${s}초` : `${s}초`
}

export default function Done({ completion: c, onAgain, onHome }: Props) {
  const top = [...c.itemIds]
    .sort((a, b) => (c.removedAt[b] ?? 0) - (c.removedAt[a] ?? 0))
    .slice(0, 5)

  return (
    <div className="page done">
      <header className="done-head">
        <div className="done-mark" aria-hidden>
          ✦
        </div>
        <h1>다 지웠어요!</h1>
        {c.reviewOf && <p className="muted">복습 완료</p>}
      </header>

      <section className="stats">
        <div className="stat blue">
          <span className="stat-num">{c.rounds}</span>
          <span className="stat-label">총 회차</span>
        </div>
        <div className="stat purple">
          <span className="stat-num">{formatDuration(c.durationMs)}</span>
          <span className="stat-label">걸린 시간</span>
        </div>
        <div className="stat cyan">
          <span className="stat-num">{c.itemIds.length}</span>
          <span className="stat-label">글자</span>
        </div>
      </section>

      <section className="card">
        <h2>가장 오래 남은 글자 TOP 5</h2>
        <ol className="top">
          {top.map((id, i) => (
            <li key={id}>
              <span className="rank">{i + 1}</span>
              <span className="kana" lang="ja">
                {id}
              </span>
              <span className="muted">{KANA[id]?.romaji}</span>
              <span className="badge yellow">{c.removedAt[id] ?? c.rounds}회차</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="spacer" />
      <footer className="bar">
        <button className="btn ghost" onClick={onHome}>
          처음으로
        </button>
        <button className="btn primary grow" onClick={onAgain}>
          같은 세트 다시
        </button>
      </footer>
    </div>
  )
}
