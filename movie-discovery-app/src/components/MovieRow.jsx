import { useRef } from 'react'

const IMG_BASE = 'https://image.tmdb.org/t/p/w342'

export default function MovieRow({ title, movies, onOpen, isSaved, onToggleSave, loading }) {
  const trackRef = useRef(null)

  function scroll(dir) {
    if (!trackRef.current) return
    trackRef.current.scrollBy({ left: dir * 480, behavior: 'smooth' })
  }

  if (!loading && (!movies || movies.length === 0)) return null

  return (
    <section className="row-section">
      <div className="row-head">
        <h2>{title}</h2>
        <div className="row-arrows">
          <button onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`}>‹</button>
          <button onClick={() => scroll(1)} aria-label={`Scroll ${title} right`}>›</button>
        </div>
      </div>
      <div className="row-track" ref={trackRef}>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <div className="row-skeleton" key={i} />)
          : movies.map((m) => (
              <div
                className="row-card"
                key={m.id}
                onClick={() => onOpen(m)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onOpen(m) }}
              >
                {m.poster_path ? (
                  <img src={`${IMG_BASE}${m.poster_path}`} alt={m.title} loading="lazy" />
                ) : (
                  <div className="row-card-fallback">🎬</div>
                )}
                <div className="row-card-gradient" />
                <button
                  className={`row-save ${isSaved(m.id) ? 'saved' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleSave(m) }}
                  aria-label="Toggle watchlist"
                >
                  🎟
                </button>
                <div className="row-card-info">
                  <span className="row-card-rating">★ {m.vote_average ? m.vote_average.toFixed(1) : '—'}</span>
                  <span className="row-card-title">{m.title}</span>
                </div>
              </div>
            ))}
      </div>
    </section>
  )
}
