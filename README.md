# reel — Movie Discovery App

Browse trending movies, search the full TMDB catalog, and save titles to a
watchlist that persists in localStorage.

## Tech
- React 18 + Vite
- TMDB API (`api.themoviedb.org`)
- Custom CSS — cinema/ticket-inspired design system

## Features
- **Home page with multiple rows** (Netflix-style): Now Showing in Pakistan,
  Trending This Week, Top Rated, Coming Soon
- **"Because you watched..."** row — recommends similar movies based on the
  last title you opened
- **Trailers** — click any movie, then "Watch Trailer" to play the YouTube
  trailer inline (falls back gracefully if TMDB has none listed)
- **Day/Night mode** toggle, persisted across visits
- Search across TMDB's full catalog
- Watchlist with localStorage persistence
- Scrolling "now trending" marquee ticker
- Skeleton loading states throughout — nothing flashes blank

## Notes on the Pakistan-specific row
"Now Showing in Pakistan" uses TMDB's `region=PK` parameter on the
`now_playing` endpoint — this reflects what's actually in Pakistani cinemas
right now, not just global trending.
1. Create a free account at [themoviedb.org](https://www.themoviedb.org/signup)
2. Go to **Settings → API** and copy your **API Key (v3 auth)**
3. Copy `.env.example` to `.env` and paste your key:
   ```
   VITE_TMDB_API_KEY=your_key_here
   ```
4. Install and run:
   ```bash
   npm install
   npm run dev
   ```

If the key is missing, the app shows a setup screen instead of a blank page
or a silent fetch failure — this is the exact bug to avoid in production.

## Deploy on Vercel
1. Push this folder to a new GitHub repo (`.env` will NOT be pushed — it's
   gitignored, which is correct, never commit API keys).
2. Import the repo at [vercel.com/new](https://vercel.com/new). Framework
   preset: **Vite**.
3. **Before deploying**, go to Project Settings → Environment Variables and
   add `VITE_TMDB_API_KEY` with your key. This step is the one most people
   miss, and it's exactly what causes "failed to fetch" on a live site that
   worked fine locally.
4. Deploy (or redeploy if you already deployed once before adding the env var).
