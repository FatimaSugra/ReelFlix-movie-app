import { useState, useEffect, useCallback } from 'react'
import MovieRow from './components/MovieRow.jsx'

const API_KEY = import.meta.env.VITE_TMDB_API_KEY
const BASE_URL = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p/w500'
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280'
const WATCHLIST_KEY = 'ReelFlix_watchlist'
const WATCHED_KEY = 'ReelFlix_watched'
const THEME_KEY = 'ReelFlix_theme'

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark'
  } catch {
    return 'dark'
  }
}

const ROWS = [
  { key: 'nowPlaying', title: 'Now Showing in Pakistan', endpoint: '/movie/now_playing?region=PK' },
  { key: 'trending', title: 'Trending This Week', endpoint: '/trending/movie/week' },
  { key: 'topRated', title: 'Top Rated of All Time', endpoint: '/movie/top_rated' },
  { key: 'upcoming', title: 'Coming Soon', endpoint: '/movie/upcoming?region=PK' },
]

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ur', label: 'Urdu' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ko', label: 'Korean' },
  { code: 'tr', label: 'Turkish' },
  { code: 'zh', label: 'Chinese' },
]

export default function App() {
  const [tab, setTab] = useState('trending') // trending(home) | search | watchlist
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchStatus, setSearchStatus] = useState('idle')
  const [searchError, setSearchError] = useState('')

  const [homeData, setHomeData] = useState({})
  const [homeLoading, setHomeLoading] = useState(true)
  const [homeError, setHomeError] = useState('')

  const [recommended, setRecommended] = useState([])
  const [recommendedSource, setRecommendedSource] = useState(null)

  const [watchlist, setWatchlist] = useState(() => loadJSON(WATCHLIST_KEY, []))
  const [watched, setWatched] = useState(() => loadJSON(WATCHED_KEY, []))
  const [theme, setTheme] = useState(loadTheme)

  const [activeId, setActiveId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailStatus, setDetailStatus] = useState('idle')
  const [trailerKey, setTrailerKey] = useState(null)
  const [showTrailer, setShowTrailer] = useState(false)

  const [genres, setGenres] = useState([])
  const [selectedGenre, setSelectedGenre] = useState(null)
  const [selectedLanguage, setSelectedLanguage] = useState(null)
  const [filteredResults, setFilteredResults] = useState([])
  const [filteredStatus, setFilteredStatus] = useState('idle')
  const [spinning, setSpinning] = useState(false)

  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist))
  }, [watchlist])

  useEffect(() => {
    localStorage.setItem(WATCHED_KEY, JSON.stringify(watched))
  }, [watched])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Load all home rows once
  useEffect(() => {
    if (!API_KEY) return
    let cancelled = false
    async function loadHome() {
      setHomeLoading(true)
      setHomeError('')
      try {
        const results = await Promise.all(
          ROWS.map((r) => fetch(`${BASE_URL}${r.endpoint}${r.endpoint.includes('?') ? '&' : '?'}api_key=${API_KEY}`).then((res) => {
            if (!res.ok) throw new Error(`${r.title} failed to load (status ${res.status}).`)
            return res.json()
          }))
        )
        if (cancelled) return
        const next = {}
        ROWS.forEach((r, i) => { next[r.key] = results[i].results || [] })
        setHomeData(next)
      } catch (err) {
        if (!cancelled) setHomeError(err.message || 'Could not load movies.')
      } finally {
        if (!cancelled) setHomeLoading(false)
      }
    }
    loadHome()
    return () => { cancelled = true }
  }, [])

  // Recommendations based on most recently watched movie
  useEffect(() => {
    if (!API_KEY || watched.length === 0) {
      setRecommended([])
      setRecommendedSource(null)
      return
    }
    let cancelled = false
    const source = watched[0]
    async function loadSimilar() {
      try {
        const res = await fetch(`${BASE_URL}/movie/${source.id}/similar?api_key=${API_KEY}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setRecommended(data.results || [])
          setRecommendedSource(source)
        }
      } catch {
        /* silent — recommendations are a bonus, not critical */
      }
    }
    loadSimilar()
    return () => { cancelled = true }
  }, [watched])

  // Fetch genre list once
  useEffect(() => {
    if (!API_KEY) return
    fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}`)
      .then((res) => res.json())
      .then((data) => setGenres(data.genres || []))
      .catch(() => {})
  }, [])

  // Fetch filtered/discover results when a genre or language is selected
  useEffect(() => {
    if (!API_KEY) return
    if (!selectedGenre && !selectedLanguage) {
      setFilteredResults([])
      setFilteredStatus('idle')
      return
    }
    let cancelled = false
    async function loadFiltered() {
      setFilteredStatus('loading')
      try {
        const params = new URLSearchParams({ api_key: API_KEY, sort_by: 'popularity.desc' })
        if (selectedGenre) params.set('with_genres', selectedGenre)
        if (selectedLanguage) params.set('with_original_language', selectedLanguage)
        const res = await fetch(`${BASE_URL}/discover/movie?${params.toString()}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!cancelled) {
          setFilteredResults(data.results || [])
          setFilteredStatus('done')
        }
      } catch {
        if (!cancelled) setFilteredStatus('error')
      }
    }
    loadFiltered()
    return () => { cancelled = true }
  }, [selectedGenre, selectedLanguage])

  const runSearch = useCallback(async (q) => {
    if (!q.trim()) return
    setSearchStatus('loading')
    setSearchError('')
    try {
      const res = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error(`TMDB responded with ${res.status}.`)
      const data = await res.json()
      setSearchResults(data.results || [])
      setSearchStatus('done')
    } catch (err) {
      setSearchError(err.message || 'Search failed.')
      setSearchStatus('error')
    }
  }, [])

  function handleSearchSubmit(e) {
    e.preventDefault()
    setTab('search')
    runSearch(query)
  }

  function toggleWatchlist(movie) {
    setWatchlist((prev) => {
      const exists = prev.some((m) => m.id === movie.id)
      if (exists) return prev.filter((m) => m.id !== movie.id)
      return [...prev, movie]
    })
  }

  const isSaved = (id) => watchlist.some((m) => m.id === id)

  function markWatched(movie) {
    setWatched((prev) => {
      const withoutDup = prev.filter((m) => m.id !== movie.id)
      return [{ id: movie.id, title: movie.title, poster_path: movie.poster_path }, ...withoutDup].slice(0, 8)
    })
  }

  function surpriseMe() {
    const pool = [
      ...(homeData.trending || []),
      ...(homeData.topRated || []),
      ...(homeData.nowPlaying || []),
    ]
    if (pool.length === 0) return
    setSpinning(true)
    setTimeout(() => {
      const pick = pool[Math.floor(Math.random() * pool.length)]
      setSpinning(false)
      openDetail(pick)
    }, 550)
  }

  async function openDetail(movie) {
    setActiveId(movie.id)
    setDetail(null)
    setDetailStatus('loading')
    setTrailerKey(null)
    setShowTrailer(false)
    markWatched(movie)
    try {
      const [detailRes, videosRes] = await Promise.all([
        fetch(`${BASE_URL}/movie/${movie.id}?api_key=${API_KEY}`),
        fetch(`${BASE_URL}/movie/${movie.id}/videos?api_key=${API_KEY}`),
      ])
      if (!detailRes.ok) throw new Error('Could not load details.')
      const data = await detailRes.json()
      setDetail(data)
      setDetailStatus('done')
      if (videosRes.ok) {
        const videoData = await videosRes.json()
        const trailer = (videoData.results || []).find(
          (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
        )
        if (trailer) setTrailerKey(trailer.key)
      }
    } catch {
      setDetail(movie)
      setDetailStatus('fallback')
    }
  }

  function closeDetail() {
    setActiveId(null)
    setDetail(null)
    setDetailStatus('idle')
    setTrailerKey(null)
    setShowTrailer(false)
  }

  useEffect(() => {
    if (!activeId) return
    function onKey(e) {
      if (e.key === 'Escape') closeDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeId])

  if (!API_KEY) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <h1>Almost there</h1>
          <p>This app needs a free TMDB API key to fetch movie data.</p>
          <ol>
            <li>Create a free account at <a href="https://www.themoviedb.org/signup" target="_blank" rel="noreferrer">themoviedb.org</a></li>
            <li>Go to Settings → API and copy your <strong>API Key (v3 auth)</strong></li>
            <li>Create a file named <code>.env</code> in the project root with:
              <pre>VITE_TMDB_API_KEY=your_key_here</pre>
            </li>
            <li>Restart <code>npm run dev</code></li>
          </ol>
          <p className="setup-note">Deploying? Add the same variable in Vercel → Project Settings → Environment Variables, then redeploy — this is the step most people miss.</p>
        </div>
      </div>
    )
  }

  const marqueeTitles = (homeData.trending || []).slice(0, 12)
  const featured = (homeData.nowPlaying && homeData.nowPlaying[0]) || (homeData.trending && homeData.trending[0]) || null
  const filtersActive = Boolean(selectedGenre || selectedLanguage)

  return (
    <div className="page">
      <header className="hero">
        <div className="ticket-strip" aria-hidden="true" />
        <div className="hero-top">
          <div>
            <h1 className="hero-title">ReelFlix</h1>
            <p className="hero-sub">Trending titles, instant search, and a watchlist that remembers.</p>
          </div>
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="Toggle day/dark mode"
            title="Toggle day/dark mode"
          >
            {theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
          </button>
        </div>

        <form className="search-bar" onSubmit={handleSearchSubmit}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a title…"
            aria-label="Search movies"
          />
          <button type="submit">Search</button>
        </form>

        <nav className="tabs">
          <button className={tab === 'trending' ? 'active' : ''} onClick={() => setTab('trending')}>Home</button>
          <button className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')} disabled={searchResults.length === 0 && tab !== 'search'}>Search results</button>
          <button className={tab === 'watchlist' ? 'active' : ''} onClick={() => setTab('watchlist')}>
            Watchlist {watchlist.length > 0 && <span className="badge">{watchlist.length}</span>}
          </button>
        </nav>
      </header>

      {tab === 'trending' && featured && (
        <section className="featured-banner" style={{ backgroundImage: `url(${BACKDROP_BASE}${featured.backdrop_path})` }}>
          <div className="featured-scrim" />
          <div className="featured-content">
            <span className="featured-tag">🎬 Featured</span>
            <h2>{featured.title}</h2>
            <p className="featured-overview">{featured.overview}</p>
            <div className="featured-actions">
              <button className="featured-btn primary" onClick={() => openDetail(featured)}>▶ More Info</button>
              <button className={`featured-btn spin ${spinning ? 'is-spinning' : ''}`} onClick={surpriseMe}>
                🎰 {spinning ? 'Spinning…' : 'Surprise Me'}
              </button>
            </div>
          </div>
        </section>
      )}

      {tab === 'trending' && (
        <div className="filter-bar">
          <div className="filter-row">
            <button className={!selectedGenre ? 'chip active' : 'chip'} onClick={() => setSelectedGenre(null)}>All genres</button>
            {genres.slice(0, 10).map((g) => (
              <button
                key={g.id}
                className={selectedGenre === g.id ? 'chip active' : 'chip'}
                onClick={() => setSelectedGenre(selectedGenre === g.id ? null : g.id)}
              >
                {g.name}
              </button>
            ))}
          </div>
          <div className="filter-row">
            <button className={!selectedLanguage ? 'chip lang active' : 'chip lang'} onClick={() => setSelectedLanguage(null)}>Any language</button>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                className={selectedLanguage === l.code ? 'chip lang active' : 'chip lang'}
                onClick={() => setSelectedLanguage(selectedLanguage === l.code ? null : l.code)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'trending' && !filtersActive && marqueeTitles.length > 0 && (
        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[...marqueeTitles, ...marqueeTitles].map((m, i) => (
              <span className="marquee-item" key={`${m.id}-${i}`}>★ {m.title}</span>
            ))}
          </div>
        </div>
      )}

      <main>
        {tab === 'trending' && (
          <>
            {homeError && (
              <div className="state-msg error">
                <p className="state-title">Couldn't load some rows</p>
                <p>{homeError}</p>
              </div>
            )}

            {filtersActive ? (
              <>
                {filteredStatus === 'loading' && (
                  <div className="movie-grid">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div className="skeleton-card" key={i} style={{ animationDelay: `${i * 40}ms` }}>
                        <div className="skeleton-poster" />
                        <div className="skeleton-line short" />
                        <div className="skeleton-line" />
                      </div>
                    ))}
                  </div>
                )}
                {filteredStatus === 'error' && (
                  <div className="state-msg error">
                    <p className="state-title">Couldn't load this filter</p>
                    <p>Try a different genre or language.</p>
                  </div>
                )}
                {filteredStatus === 'done' && filteredResults.length === 0 && (
                  <div className="state-msg">
                    <p className="state-title">No matches</p>
                    <p>Try a different genre or language combination.</p>
                  </div>
                )}
                {filteredResults.length > 0 && (
                  <div className="movie-grid">
                    {filteredResults.map((m, i) => (
                      <MovieCard key={m.id} m={m} i={i} onOpen={openDetail} isSaved={isSaved} onToggleSave={toggleWatchlist} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {recommended.length > 0 && recommendedSource && (
                  <MovieRow
                    title={`Because you watched "${recommendedSource.title}"`}
                    movies={recommended}
                    onOpen={openDetail}
                    isSaved={isSaved}
                    onToggleSave={toggleWatchlist}
                    loading={false}
                  />
                )}

                {ROWS.map((r) => (
                  <MovieRow
                    key={r.key}
                    title={r.title}
                    movies={homeData[r.key]}
                onOpen={openDetail}
                isSaved={isSaved}
                onToggleSave={toggleWatchlist}
                loading={homeLoading}
              />
            ))}
              </>
            )}
          </>
        )}

        {tab === 'search' && (
          <>
            {searchStatus === 'loading' && (
              <div className="movie-grid">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div className="skeleton-card" key={i} style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="skeleton-poster" />
                    <div className="skeleton-line short" />
                    <div className="skeleton-line" />
                  </div>
                ))}
              </div>
            )}
            {searchStatus === 'error' && (
              <div className="state-msg error">
                <p className="state-title">Search failed</p>
                <p>{searchError}</p>
              </div>
            )}
            {searchStatus === 'done' && searchResults.length === 0 && (
              <div className="state-msg">
                <p className="state-title">No results</p>
                <p>Try a different title or check the spelling.</p>
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="movie-grid">
                {searchResults.map((m, i) => (
                  <MovieCard key={m.id} m={m} i={i} onOpen={openDetail} isSaved={isSaved} onToggleSave={toggleWatchlist} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'watchlist' && (
          <>
            {watchlist.length === 0 ? (
              <div className="state-msg">
                <p className="state-title">Your watchlist is empty</p>
                <p>Tap the ticket icon on any movie to save it here.</p>
              </div>
            ) : (
              <div className="movie-grid">
                {watchlist.map((m, i) => (
                  <MovieCard key={m.id} m={m} i={i} onOpen={openDetail} isSaved={isSaved} onToggleSave={toggleWatchlist} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <p> 2026 ReelFlix.</p>
      </footer>

      {activeId && (
        <div className="modal-backdrop" onClick={closeDetail}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button className="modal-close" onClick={closeDetail} aria-label="Close">×</button>
            {detailStatus === 'loading' && (
              <div className="modal-loading">
                <div className="pulse-dot" />
                <p>Loading details…</p>
              </div>
            )}
            {detail && (
              <>
                <div className="modal-media">
                  {showTrailer && trailerKey ? (
                    <iframe
                      className="modal-trailer"
                      src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
                      title="Trailer"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  ) : detail.backdrop_path ? (
                    <div className="modal-backdrop-img" style={{ backgroundImage: `url(${BACKDROP_BASE}${detail.backdrop_path})` }}>
                      {trailerKey && (
                        <button className="play-trailer-btn" onClick={() => setShowTrailer(true)}>
                          ▶ Watch Trailer
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="modal-body">
                  <h2>{detail.title}</h2>
                  <div className="modal-meta">
                    <span>★ {detail.vote_average ? detail.vote_average.toFixed(1) : '—'}</span>
                    <span>{detail.release_date ? detail.release_date.slice(0, 4) : 'TBA'}</span>
                    {detail.runtime ? <span>{detail.runtime} min</span> : null}
                  </div>
                  {detail.genres && detail.genres.length > 0 && (
                    <div className="modal-genres">
                      {detail.genres.map((g) => <span key={g.id} className="genre-chip">{g.name}</span>)}
                    </div>
                  )}
                  <p className="modal-overview">{detail.overview || 'No overview available.'}</p>
                  <button
                    className={`modal-save ${isSaved(detail.id) ? 'saved' : ''}`}
                    onClick={() => toggleWatchlist(detail)}
                  >
                    {isSaved(detail.id) ? '🎟 In watchlist' : '🎟 Add to watchlist'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MovieCard({ m, i, onOpen, isSaved, onToggleSave }) {
  return (
    <article
      className="movie-card"
      style={{ animationDelay: `${(i % 10) * 40}ms` }}
      onClick={() => onOpen(m)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(m) }}
    >
      <div className="poster-wrap">
        {m.poster_path ? (
          <img src={`${IMG_BASE}${m.poster_path}`} alt={m.title} loading="lazy" />
        ) : (
          <div className="poster-fallback"><span>🎬</span><p>No poster</p></div>
        )}
        <div className="poster-gradient" aria-hidden="true" />
        <button
          className={`save-btn ${isSaved(m.id) ? 'saved' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleSave(m) }}
          aria-label={isSaved(m.id) ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          🎟
        </button>
        <div className="rating-badge">
          <span className="rating-star">★</span>{m.vote_average ? m.vote_average.toFixed(1) : '—'}
        </div>
        <div className="poster-overlay-info">
          <h3>{m.title}</h3>
          <p className="movie-year">{m.release_date ? m.release_date.slice(0, 4) : 'TBA'}</p>
        </div>
      </div>
    </article>
  )
}
