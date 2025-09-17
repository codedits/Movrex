"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useCallback, Suspense, useDeferredValue, useRef } from "react";
import Fuse from 'fuse.js';
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Info, ArrowRight } from "lucide-react";
import useScrollDirection from "@/hooks/useScrollDirection";
import LoadingScreen from "@/components/LoadingScreen";
//

type Movie = {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
  vote_count?: number;
};

const TMDB = {
  base: "https://api.themoviedb.org/3",
  key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
  img: (path: string, size: "w300" | "w500" | "w780" | "w1280" | "original" = "w500") =>
    `https://image.tmdb.org/t/p/${size}${path}`,
};

const isDev = process.env.NODE_ENV === 'development';

type Genre = { id: number; name: string };
type Filters = {
  actorName: string;
  genreIds: number[];
  yearFrom: string;
  yearTo: string;
  ratingFrom: string;
  ratingTo: string;
  sortBy: string;
  searchType?: "movie" | "actor";
  releaseDateFrom?: string;
  releaseDateTo?: string;
};

// Simple in-memory caches (reset on reload)
type TMDBSearchResponse = { results?: Movie[]; total_results?: number; total_pages?: number } | null;
const searchCache = new Map<string, TMDBSearchResponse>(); // key: `${query}::${page}` -> full data
const personCache = new Map<string, Array<{ id: number; name: string }>>(); // key: query -> people list
const creditsCache = new Map<number, Movie[]>(); // key: personId -> movies

// Helper: pick N random hero movies from the trending list
function getRandomHeroMovies(list: Movie[], count = 3): Movie[] {
  if (!Array.isArray(list) || list.length === 0) return [];

  // Prefer movies that have a backdrop or poster
  const withImages = list.filter((m) => !!(m.backdrop_path || m.poster_path));
  // Use the image-bearing set when it's large enough, otherwise fall back to the full list
  const source = (withImages.length >= count ? withImages.slice() : list.slice());

  // Fisher-Yates shuffle
  for (let i = source.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = source[i];
    source[i] = source[j];
    source[j] = tmp;
  }

  return source.slice(0, Math.min(count, source.length));
}

// Skeleton loader component
const MovieCardSkeleton = () => (
  <div className="animate-pulse">
    <div className="aspect-[2/3] bg-gray-800 rounded-lg mb-2"></div>
    <div className="h-4 bg-gray-800 rounded mb-1"></div>
    <div className="h-3 bg-gray-800 rounded w-2/3"></div>
  </div>
);

function HomeContent() {
  const scrollDir = useScrollDirection(12);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState("");
  // Immediate input the user types into; commit to `query` after debounce.
  const [inputValue, setInputValue] = useState("");
  const [trending, setTrending] = useState<Movie[]>([]);
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<"trending" | "popular" | "top_rated" | "upcoming" | "anime">(
    "trending"
  );
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const moviesPerPage = 18;
  
  // Search state for smooth UX
  const [showNoResults, setShowNoResults] = useState(false);
  // Actor search states
  const [personSuggestions, setPersonSuggestions] = useState<Array<{ id: number; name: string }>>([]);
  const [isActorMode, setIsActorMode] = useState(false);
  // const [selectedActorId, setSelectedActorId] = useState<number | null>(null);
  const [selectedActorName, setSelectedActorName] = useState<string | null>(null);
  const [actorAllMovies, setActorAllMovies] = useState<Movie[]>([]);
  const [actorQueryAtActivation, setActorQueryAtActivation] = useState<string | null>(null);
  const [areSuggestionsVisible, setAreSuggestionsVisible] = useState(false);
  const [suppressSuggestions, setSuppressSuggestions] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const urlUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close suggestions on outside click or window blur
  useEffect(() => {
    if (!areSuggestionsVisible) return;
    const handleDocClick = (e: MouseEvent) => {
      const container = searchBoxRef.current;
      if (container && !container.contains(e.target as Node)) {
        setPersonSuggestions([]);
        setAreSuggestionsVisible(false);
        setSuppressSuggestions(true);
      }
    };
    const handleWindowBlur = () => {
      setPersonSuggestions([]);
      setAreSuggestionsVisible(false);
      setSuppressSuggestions(true);
    };
    document.addEventListener('mousedown', handleDocClick);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [areSuggestionsVisible]);

  // Filters state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersActive, setFiltersActive] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    actorName: "",
    genreIds: [],
    yearFrom: "",
    yearTo: "",
    ratingFrom: "",
    ratingTo: "",
    sortBy: "popularity.desc",
    searchType: "movie",
    releaseDateFrom: "",
    releaseDateTo: "",
  });
  const [allGenres, setAllGenres] = useState<Genre[]>([]);

  // Memoized fetch function
  const fetchMovies = useCallback(async (
    endpoint: string,
    signal: AbortSignal
  ): Promise<Movie[]> => {
    try {
      const response = await fetch(endpoint, { signal });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      // Always return a safe empty array on abort or failure
      if (error instanceof Error && error.name === 'AbortError') return [];
      console.error('Fetch error:', error);
      return [];
    }
  }, []);

  // Separate search function that returns full API response
  const searchMovies = useCallback(async (query: string, page: number, signal: AbortSignal) => {
    try {
      if (!TMDB.key) {
        console.error('TMDB API key is not configured');
        return null;
      }
      
      const cacheKey = `${query}::${page}`;
      if (searchCache.has(cacheKey)) {
        if (isDev) console.log('⚡ cache hit (search):', cacheKey);
        return searchCache.get(cacheKey);
      }
      
      const movieEndpoint = `${TMDB.base}/search/movie?query=${encodeURIComponent(query)}&api_key=${TMDB.key}&page=${page}`;
      const movieRes = await fetch(movieEndpoint, { signal });
      
      if (!movieRes.ok) {
        const errorText = await movieRes.text();
        console.error('TMDB API error:', movieRes.status, errorText);
        throw new Error(`TMDB API error: ${movieRes.status}`);
      }
      
      const movieData = await movieRes.json();
      
      // Validate the response structure
      if (!movieData || typeof movieData !== 'object') {
        console.error('Invalid TMDB response structure:', movieData);
        return null;
      }
      
      searchCache.set(cacheKey, movieData);
      return movieData;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return null;
      console.error('Search error:', error);
      return null;
    }
  }, []);

  // Fuse instance for client-side fuzzy fallback searches (built on trending + cached results)
  const fuseRef = useRef<Fuse<Movie> | null>(null);
  useEffect(() => {
    const MAX_FUSE_ITEMS = 200; // cap to avoid heavy index builds on low-end devices

    const score = (m: Movie) => {
      const r = typeof m.vote_average === 'number' ? m.vote_average : 0;
      const p = typeof m.popularity === 'number' ? m.popularity : 0;
      return r * 1000 + p;
    };

    const buildIndexNow = () => {
      const base: Movie[] = [];
      if (Array.isArray(trending)) base.push(...trending);
      for (const value of searchCache.values()) {
        if (value && Array.isArray(value.results)) base.push(...value.results);
      }
      const map = new Map<number, Movie>();
      for (const m of base) {
        if (m && typeof m.id === 'number' && !map.has(m.id)) map.set(m.id, m);
      }
      let list = Array.from(map.values());

      if (list.length > MAX_FUSE_ITEMS) {
        list = list.sort((a, b) => score(b) - score(a)).slice(0, MAX_FUSE_ITEMS);
      }

      if (list.length > 0) {
        try {
          fuseRef.current = new Fuse(list, {
            keys: ['title', 'name', 'overview'],
            threshold: 0.4,
            ignoreLocation: true,
            includeScore: true,
          });
        } catch (e) {
          console.warn('Failed to build Fuse index:', e);
          fuseRef.current = null;
        }
      } else {
        fuseRef.current = null;
      }
    };

    // Schedule index build during idle time to avoid blocking initial paint
    const schedule = () => {
      if (typeof window === 'undefined') return buildIndexNow();
      if ('requestIdleCallback' in window) {
        const win = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => void };
        if (typeof win.requestIdleCallback === 'function') {
          win.requestIdleCallback(buildIndexNow, { timeout: 1200 });
        } else {
          setTimeout(buildIndexNow, 600);
        }
      } else {
        setTimeout(buildIndexNow, 600);
      }
    };

    schedule();
    // rebuild when trending changes
  }, [trending]);

  // Utility: client-side sorting for search results when filtersActive
  const sortMoviesBy = useCallback((list: Movie[], sortBy: string): Movie[] => {
    const items = Array.isArray(list) ? list.slice() : [];
    const [key, dir] = (sortBy || 'popularity.desc').split('.') as [string, string];
    const factor = dir === 'asc' ? 1 : -1;
    // decorate-sort-undecorate to compute key once per item
    const decorated = items.map((m, i) => {
      let val = 0;
      if (key === 'vote_average') val = typeof m.vote_average === 'number' ? m.vote_average : 0;
      else if (key === 'popularity') val = typeof m.popularity === 'number' ? m.popularity : 0;
      else if (key === 'primary_release_date') {
        const d = m.release_date || m.first_air_date || '';
        const t = d ? Date.parse(d) : 0;
        val = isNaN(t) ? 0 : t;
      }
      return { m, i, val };
    });
    decorated.sort((a, b) => (a.val - b.val) * factor || a.i - b.i);
    return decorated.map(d => d.m);
  }, []);

  // Discover with filters (server API wrapper)
  const discoverMovies = useCallback(async (
    f: Filters,
    page: number,
    signal: AbortSignal
  ) => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      // Only sorting + actor/movie selection are supported now
      if (f.sortBy) params.set("sort_by", f.sortBy);

      // Resolve actor name -> person id (first match) when provided
      if ((f.searchType === "actor" || f.actorName) && f.actorName && f.actorName.trim()) {
        try {
          const url = `${TMDB.base}/search/person?query=${encodeURIComponent(f.actorName.trim())}&api_key=${TMDB.key}`;
          const res = await fetch(url, { signal });
          const data = await res.json();
          const pid = Array.isArray(data?.results) && data.results.length > 0 ? data.results[0]?.id : undefined;
          if (typeof pid === 'number') params.set("with_people", String(pid));
        } catch (e) {
          if (isDev) console.warn('actor resolve failed', e);
        }
      }

      const endpoint = `/api/discover?${params.toString()}`;
      const res = await fetch(endpoint, { signal });
      if (!res.ok) throw new Error('Failed to fetch filtered movies');
      const json = await res.json();
      return json as { results?: Movie[]; total_results?: number; total_pages?: number };
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return null;
      console.error('Discover error:', e);
      return null;
    }
  }, []);

  // Check TMDB API key configuration
  useEffect(() => {
    if (!TMDB.key) {
      console.error('❌ TMDB API key is not configured. Please check your environment variables.');
    } else if (isDev) {
      console.log('✅ TMDB API key is configured');
    }
  }, []);

  // Hide loading screen after initial content preloads
  useEffect(() => {
    let didCancel = false;
    const t = setTimeout(() => {
      if (didCancel) return;
      setShowLoadingScreen(false);
      setIsInitialLoad(false);
    }, 700);

    return () => { didCancel = true; clearTimeout(t); };
  }, []);

  // Cleanup URL debounce on unmount
  useEffect(() => {
    return () => {
      if (urlUpdateTimeoutRef.current) {
        clearTimeout(urlUpdateTimeoutRef.current);
        urlUpdateTimeoutRef.current = null;
      }
    };
  }, []);

  // If chat stored a pending query, hydrate it once on mount
  useEffect(() => {
    try {
      const pending = localStorage.getItem('mm_pending_query');
      if (pending) {
        setQuery(pending);
        setInputValue(pending);
        setCurrentPage(1);
        // Reflect into URL so back button works
        router.replace(`/?q=${encodeURIComponent(pending)}`);
        localStorage.removeItem('mm_pending_query');
      }
    } catch {}
  }, [router]);

  // Sync `?q=` from URL into local query state (supports chat deep-links)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const q = (searchParams?.get("q") || "").trim();
    if (q !== query) {
      setQuery(q);
      setInputValue(q);
      setCurrentPage(1);
      // Exiting actor mode if URL-driven search arrives
      setIsActorMode(false);
      setSelectedActorName(null);
      setActorAllMovies([]);
      setPersonSuggestions([]);
    }
  }, [searchParams]);

  // Avoid a loop: only URL-update during direct input

  // Optimized category fetch (preload early for hero)
  useEffect(() => {
    if (query.trim()) return;
    
    const controller = new AbortController();
    let endpoint: string;
    if (category === "trending") {
      endpoint = `${TMDB.base}/trending/movie/week?api_key=${TMDB.key}`;
    } else if (category === "anime") {
      // Use discover to filter Animation genre (id 16) and prefer Japanese originals
      endpoint = `${TMDB.base}/discover/movie?with_genres=16&with_original_language=ja&sort_by=popularity.desc&api_key=${TMDB.key}`;
    } else {
      endpoint = `${TMDB.base}/movie/${category}?api_key=${TMDB.key}`;
    }
    
    setLoading(true);
    
    fetchMovies(endpoint, controller.signal)
      .then((movies) => {
        if (Array.isArray(movies) && movies.length > 0) {
          setTrending(movies);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [category, query, fetchMovies]);

  // Load genres when opening filters
  useEffect(() => {
    if (!filtersOpen || allGenres.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const url = `${TMDB.base}/genre/movie/list?api_key=${TMDB.key}`;
        const res = await fetch(url, { cache: 'force-cache' });
        const data = await res.json();
        const list: Genre[] = Array.isArray(data?.genres) ? data.genres : [];
        if (!cancelled) setAllGenres(list);
      } catch (e) {
        if (isDev) console.warn('genres load failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [filtersOpen, allGenres.length]);

  // Fetch when filters are active
  useEffect(() => {
    if (!filtersActive) return;
    if (isDev) console.log('🔎 Filters effect triggered:', { filters, currentPage });
    const controller = new AbortController();
    setLoading(true);
    setShowNoResults(false);
    const doWork = async () => {
      // If actor mode is selected in filters, resolve actor and show their movies
      if ((filters.searchType ?? 'movie') === 'actor') {
        try {
          if (!query.trim() && !filters.actorName?.trim()) {
            setResults([]);
            setTotalResults(0);
            setTotalPages(1);
            setShowNoResults(true);
            return;
          }
          const name = filters.actorName?.trim() || query.trim();
          const url = `${TMDB.base}/search/person?query=${encodeURIComponent(name)}&api_key=${TMDB.key}`;
          const res = await fetch(url, { signal: controller.signal });
          const data = await res.json();
          const personId = Array.isArray(data?.results) && data.results.length > 0 ? data.results[0]?.id : undefined;
          if (!personId) {
            setResults([]);
            setTotalResults(0);
            setTotalPages(1);
            setShowNoResults(true);
            return;
          }
          const creditsEndpoint = `${TMDB.base}/person/${personId}/movie_credits?api_key=${TMDB.key}`;
          const cres = await fetch(creditsEndpoint, { signal: controller.signal });
          const cdata = await cres.json();
          const movies: Movie[] = Array.isArray(cdata?.cast) ? cdata.cast : [];
          const unique = Array.from(new Map(movies.map(m => [m.id, m])).values());
          const sorted = filters.sortBy ? sortMoviesBy(unique, filters.sortBy) : unique;
          setResults(sorted);
          setTotalResults(sorted.length);
          setTotalPages(Math.max(1, Math.ceil(sorted.length / moviesPerPage)));
          setIsActorMode(true);
          setSelectedActorName(data.results[0]?.name || null);
          setActorAllMovies(sorted);
          // Don't unconditionally reset currentPage here — the Apply filters button
          // already resets to page 1. Resetting on every effect run causes the
          // page to snap back to 1 when users try to change pages. Keep current
          // page intact so pagination controls work as expected.
        } catch (e) {
          console.error('Actor filter flow failed:', e);
          setResults([]);
          setTotalResults(0);
          setTotalPages(1);
          setShowNoResults(true);
        } finally {
          setLoading(false);
        }
        return;
      }

      // Movie mode: use discover for sorting server-side if available, else sort client-side
      const data = await discoverMovies(filters, currentPage, controller.signal);
      if (data && Array.isArray(data.results)) {
        const list = filters.sortBy ? sortMoviesBy(data.results, filters.sortBy) : data.results;
        setResults(list);
        setTotalResults(data.total_results || list.length || 0);
        setTotalPages(data.total_pages || Math.ceil((data.total_results || list.length || 0) / moviesPerPage));
      } else {
        setResults([]);
        setTotalResults(0);
        setTotalPages(1);
        setTimeout(() => setShowNoResults(true), 500);
      }
      setLoading(false);
    };
    doWork();
    return () => controller.abort();
  }, [filtersActive, filters, currentPage, discoverMovies, moviesPerPage, query, sortMoviesBy]);

  // Optimized search with debouncing
  useEffect(() => {
    if (isDev) console.log('🔍 Search effect triggered:', { query, currentPage, isActorMode });

    // When in actor mode, pause normal search logic
    if (isActorMode) {
      return;
    }
    // If filters are active and actor mode is selected in filters, skip normal search
    if (filtersActive && (filters.searchType ?? 'movie') === 'actor') {
      return;
    }

    if (!deferredQuery || !deferredQuery.trim()) {
      if (isDev) console.log('❌ Empty query, clearing results');
      setResults([]);
      setCurrentPage(1);
      setTotalPages(1);
      setTotalResults(0);
      setShowNoResults(false); // Hide no results message immediately
      setSelectedActorName(null);
      setActorAllMovies([]);
      setIsActorMode(false);
      setAreSuggestionsVisible(false);
      return;
    }
    


    let controller: AbortController | null = null;
    const timeoutId = setTimeout(() => {
      if (isActorMode) return; // extra guard at execution time
  if (isDev) console.log('🚀 Starting search for:', deferredQuery, 'page:', currentPage);
  setLoading(true);
  setShowNoResults(false); // Hide no results while loading
      controller = new AbortController();
      searchMovies(deferredQuery, currentPage, controller.signal)
        .then((data) => {
          if (isDev) console.log('📊 Search data received for query:', deferredQuery, 'Data:', data);
          
          // Debug the data structure
          if (isDev && data) {
            console.log('🔍 Data structure analysis:', {
              hasData: !!data,
              dataType: typeof data,
              hasResults: !!data.results,
              resultsType: Array.isArray(data.results),
              resultsLength: data.results?.length,
              firstResult: data.results?.[0],
              totalResults: data.total_results,
              totalPages: data.total_pages
            });
          }
          
          if (data && data.results && Array.isArray(data.results) && data.results.length > 0) {
            let list = data.results as Movie[];
            
            // Debug the results before sorting
            if (isDev) {
              console.log('🎬 Raw results before processing:', list.slice(0, 2));
              console.log('🔍 First result structure:', list[0] ? {
                id: list[0].id,
                title: list[0].title,
                name: list[0].name,
                hasId: typeof list[0].id === 'number',
                hasTitle: typeof list[0].title === 'string',
                hasName: typeof list[0].name === 'string'
              } : 'No first result');
            }
            
            if (filtersActive && (filters.searchType ?? 'movie') === 'movie' && filters.sortBy) {
              list = sortMoviesBy(list, filters.sortBy);
            }
            if (isDev) console.log('🎯 Movies found:', list.length);
            setResults(list);
            setTotalResults(data.total_results || 0);
            setTotalPages(data.total_pages || Math.ceil((data.total_results || 0) / moviesPerPage));
            setSelectedActorName(null);
            setIsActorMode(false);
            setActorAllMovies([]);
            setShowNoResults(false); // Hide no results when we have results
            // Persist recent search term (once we get a successful response)
            try {
              const key = 'recent_searches';
              const raw = localStorage.getItem(key);
              const list: Array<{ q: string; ts: number }> = raw ? JSON.parse(raw) : [];
            const trimmed = deferredQuery.trim();
              if (trimmed) {
                const now = Date.now();
                const cutoff = now - 15 * 24 * 60 * 60 * 1000;
                const pruned = list.filter((x) => x.ts >= cutoff && x.q.toLowerCase() !== trimmed.toLowerCase());
                pruned.unshift({ q: trimmed, ts: now });
                const capped = pruned.slice(0, 10);
                localStorage.setItem(key, JSON.stringify(capped));
                // setRecentSearches(capped.map((x) => x.q)); // This line was removed from the original file
              }
            } catch {}
          } else {
            if (isDev) console.log('⚠️ No results in data, trying fuzzy fallback:', data);
            // Try fuzzy client-side fallback using Fuse (on cached/trending data)
            const fuse = fuseRef.current;
            if (fuse && deferredQuery.trim()) {
              const fuseRes = fuse.search(deferredQuery.trim(), { limit: 50 });
              const mapped = fuseRes.map(r => r.item);
              if (mapped.length > 0) {
                if (isDev) console.log('🔎 Fuzzy fallback matched:', mapped.length);
                setResults(mapped.slice(0, moviesPerPage));
                setTotalResults(mapped.length);
                setTotalPages(Math.max(1, Math.ceil(mapped.length / moviesPerPage)));
                setSelectedActorName(null);
                setIsActorMode(false);
                setActorAllMovies([]);
                setShowNoResults(false);
                // Persist recent search term
                try { const key = 'recent_searches'; const raw = localStorage.getItem(key); const list: Array<{ q: string; ts: number }> = raw ? JSON.parse(raw) : []; const trimmed = deferredQuery.trim(); if (trimmed) { const now = Date.now(); const cutoff = now - 15 * 24 * 60 * 60 * 1000; const pruned = list.filter((x) => x.ts >= cutoff && x.q.toLowerCase() !== trimmed.toLowerCase()); pruned.unshift({ q: trimmed, ts: now }); const capped = pruned.slice(0, 10); localStorage.setItem(key, JSON.stringify(capped)); } } catch {}
                // done
                return;
              }
            }
            // No fuzzy matches either: show no results
            setResults([]);
            setTotalResults(0);
            setTotalPages(1);
            setSelectedActorName(null);
            setIsActorMode(false);
            setActorAllMovies([]);
            setShowNoResults(true);
          }
        })
  .catch((error) => {
          if (error instanceof Error && error.name === 'AbortError') {
            if (isDev) console.log('🔕 Search aborted');
            return;
          }
          console.error('❌ Search error:', error);
          
          // Handle specific error types
          if (error instanceof Error) {
            if (error.message.includes('TMDB API error: 401')) {
              console.error('❌ TMDB API key is invalid or expired');
            } else if (error.message.includes('TMDB API error: 429')) {
              console.error('❌ TMDB API rate limit exceeded');
            } else if (error.message.includes('TMDB API error: 500')) {
              console.error('❌ TMDB API server error');
            }
          }
          
          // Keep previous results to avoid jank; clear only on explicit errors
          setResults([]);
          setTotalResults(0);
          setTotalPages(1);
          setSelectedActorName(null);
          setIsActorMode(false);
          setActorAllMovies([]);
          // Show no results message immediately on error
          setShowNoResults(true);
        })
        .finally(() => setLoading(false));
    }, 60); // debounce delay

    return () => {
      clearTimeout(timeoutId);
      if (controller) controller.abort();
    };
  }, [deferredQuery, currentPage, searchMovies, isActorMode, moviesPerPage, filtersActive, filters.searchType, filters.sortBy, sortMoviesBy]);

  // Fetch suggestions on inputValue change (debounced) — stay responsive while the main search is debounced
  useEffect(() => {
    // If in actor mode, keep it active unless the user changes the query
    if (isActorMode) {
      if (actorQueryAtActivation !== null && inputValue !== actorQueryAtActivation) {
        // User changed query: clear actor filter
        setIsActorMode(false);
        setSelectedActorName(null);
        setActorAllMovies([]);
        setActorQueryAtActivation(null);
        setCurrentPage(1);
      }
      return; // Do not fetch person suggestions while in actor mode
    }

    // If filters specify actor mode, fetch ACTOR suggestions for the current query (used internally, not shown in dropdown)
    if (filtersActive && (filters.searchType ?? 'movie') === 'actor') {
      setPersonSuggestions([]);
      if (!inputValue || !inputValue.trim()) return;
      const controller = new AbortController();
      const timeoutId = setTimeout(async () => {
        try {
          const endpoint = `${TMDB.base}/search/person?query=${encodeURIComponent(inputValue)}&api_key=${TMDB.key}`;
          if (personCache.has(inputValue)) {
            const fromCache = personCache.get(inputValue)!;
            setPersonSuggestions(fromCache);
            return;
          }
          const res = await fetch(endpoint, { signal: controller.signal });
          if (!res.ok) throw new Error('Failed to fetch person suggestion');
          const data = await res.json();
          type PersonLite = { id: number; name: string };
          const raw: unknown[] = Array.isArray(data?.results) ? (data.results as unknown[]) : [];
          const isPersonLite = (x: unknown): x is PersonLite => {
            if (!x || typeof x !== 'object') return false;
            const obj = x as Record<string, unknown>;
            return typeof obj.id === 'number' && typeof obj.name === 'string';
          };
          const mapped: Array<PersonLite> = raw.filter(isPersonLite).slice(0, 5);
          if (mapped.length > 0) {
            personCache.set(query, mapped);
            setPersonSuggestions(mapped);
          } else {
            setPersonSuggestions([]);
          }
        } catch (err) {
          if (!(err instanceof Error && err.name === 'AbortError')) {
            console.warn('Person suggestion error:', err);
          }
        }
      }, 300);
      return () => { clearTimeout(timeoutId); controller.abort(); };
    }

    // Otherwise, fetch MOVIE suggestions for the dropdown
    if (suppressSuggestions) return;
    setPersonSuggestions([]);
    setAreSuggestionsVisible(true);
    if (!query || !query.trim()) return;
    

    
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        if (!TMDB.key) {
          console.error('TMDB API key is not configured for suggestions');
          return;
        }
        
        const endpoint = `${TMDB.base}/search/movie?query=${encodeURIComponent(inputValue)}&api_key=${TMDB.key}`;
        // reuse cache shape; store top 5 movie suggestions as {id,name:title}
        if (personCache.has(inputValue)) {
          const fromCache = personCache.get(inputValue)!;
          setPersonSuggestions(fromCache);
          return;
        }
        
        const res = await fetch(endpoint, { signal: controller.signal });
        if (!res.ok) {
          const errorText = await res.text();
          console.error('TMDB suggestions API error:', res.status, errorText);
          throw new Error(`TMDB suggestions API error: ${res.status}`);
        }
        
        const data = await res.json();
        
        // Debug logging for problematic queries
        if (isDev) {
          console.log('🔍 TMDB suggestions response for query:', inputValue);
          console.log('📊 Response structure:', {
            hasData: !!data,
            dataType: typeof data,
            hasResults: !!data?.results,
            resultsType: Array.isArray(data?.results),
            resultsLength: data?.results?.length,
            firstResult: data?.results?.[0]
          });
        }
        
        // Validate the response structure
        if (!data || typeof data !== 'object' || !Array.isArray(data.results)) {
          console.error('Invalid TMDB suggestions response structure:', data);
          setPersonSuggestions([]);
          return;
        }
        
        type MovieLite = { id: number; title: string };
        const raw: unknown[] = data.results;
        
        if (isDev) {
          console.log('🎬 Raw results before mapping:', raw.slice(0, 2));
        }
        
        const mapped = raw
          .map((x, index) => {
            try {
              if (isDev) console.log(`🔍 Mapping item ${index}:`, x);
              if (!x || typeof x !== 'object') {
                if (isDev) console.log(`❌ Item ${index} is not an object:`, x);
                return null;
              }
              const obj = x as Record<string, unknown>;
              const id = obj.id;
              const title = (obj.title || obj.name) as unknown;
              
              if (isDev) console.log(`🔍 Item ${index} - id:`, id, 'title:', title, 'types:', typeof id, typeof title);
              
              if (typeof id === 'number' && typeof title === 'string') {
                return { id, name: title } as { id: number; name: string };
              }
              
              if (isDev) console.log(`❌ Item ${index} failed validation - id:`, id, 'title:', title);
              return null;
            } catch (mapError) {
              console.error(`❌ Error mapping movie suggestion item ${index}:`, mapError, 'Item:', x);
              return null;
            }
          })
          .filter(Boolean)
          .slice(0, 5) as Array<{ id: number; name: string }>;
          
        if (mapped.length > 0) {
          personCache.set(inputValue, mapped);
          setPersonSuggestions(mapped);
        } else {
          // Try fuzzy fallback suggestions
          const fuse = fuseRef.current;
          if (fuse && inputValue.trim()) {
            const f = fuse.search(inputValue.trim(), { limit: 5 }).map(r => ({ id: r.item.id, name: r.item.title || r.item.name || '' }));
            if (f.length > 0) {
              personCache.set(inputValue, f);
              setPersonSuggestions(f);
              return;
            }
          }
          setPersonSuggestions([]);
        }
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          console.warn('Movie suggestion error:', err);
          setPersonSuggestions([]);
        }
      }
    }, 300);
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [query, isActorMode, actorQueryAtActivation, filtersActive, filters.searchType, suppressSuggestions]);

  // Confirm actor selection -> fetch all movies, paginate client-side
  const handleConfirmActor = useCallback(async (selected?: { id: number; name: string }) => {
    if (!selected) return;
    setPersonSuggestions([]); // prevent suggestions from reappearing
    setLoading(true);
    try {
      let allMovies: Movie[] = creditsCache.get(selected.id) ?? [];
      if (allMovies.length === 0) {
        const creditsEndpoint = `${TMDB.base}/person/${selected.id}/movie_credits?api_key=${TMDB.key}`;
        const res = await fetch(creditsEndpoint);
        if (!res.ok) throw new Error('Failed to fetch person credits');
        const creditsData = await res.json();
        allMovies = Array.isArray(creditsData?.cast) ? creditsData.cast : [];
        creditsCache.set(selected.id, allMovies);
      }
      const uniqueById = new Map<number, Movie>();
      for (const m of allMovies) {
        if (m && typeof m.id === 'number' && !uniqueById.has(m.id)) {
          uniqueById.set(m.id, m);
        }
      }
      const uniqueMovies = Array.from(uniqueById.values());
      // selected actor id no longer stored; name used for display
      setSelectedActorName(selected.name);
      setIsActorMode(true);
      setActorQueryAtActivation(query);
      setActorAllMovies(uniqueMovies);
      setTotalResults(uniqueMovies.length);
      setTotalPages(Math.max(1, Math.ceil(uniqueMovies.length / moviesPerPage)));
      setCurrentPage(1);
      setResults(uniqueMovies.slice(0, moviesPerPage));
      setShowNoResults(uniqueMovies.length === 0);
    } catch (error) {
      console.error('Confirm actor error:', error);
    } finally {
      setLoading(false);
    }
  }, [moviesPerPage, query]);

  const handleDismissSuggestion = useCallback(() => {
    setPersonSuggestions([]);
  }, []);

  const clearActorFilter = useCallback(() => {
    setIsActorMode(false);
    setSelectedActorName(null);
    setActorAllMovies([]);
    setActorQueryAtActivation(null);
    setCurrentPage(1);
    // Leave query as is; normal search effect will run
  }, []);

  // When page changes in actor mode, update the slice
  useEffect(() => {
    if (!isActorMode) return;
    const start = (currentPage - 1) * moviesPerPage;
    const end = start + moviesPerPage;
    setResults(actorAllMovies.slice(start, end));
  }, [isActorMode, currentPage, moviesPerPage, actorAllMovies]);

  // Memoized computed values
  const rows = useMemo(() => {
    if (filtersActive) {
      return Array.isArray(results) ? results : [];
    }
    // Use deferredQuery so the UI doesn't flip immediately while typing
    if (deferredQuery && deferredQuery.trim()) {
      return Array.isArray(results) ? results : [];
    }
    // If not searching, show trending movies
    return Array.isArray(trending) ? trending.slice(0, moviesPerPage) : [];
  }, [filtersActive, deferredQuery, results, trending]);
  
  // Featured memo not used separately (hero uses heroMovies instead)

  // Hero carousel (top 3 best movies)
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const heroMovies = useMemo<Movie[]>(() => {
    if (deferredQuery || !trending || trending.length === 0) return [];
    return getRandomHeroMovies(trending, 3);
  }, [deferredQuery, trending]);

  // Advance hero every 5 seconds with smooth transition
  useEffect(() => {
    if (heroMovies.length <= 1) return;
    const t = setInterval(() => {
      setCurrentHeroIndex((i) => (i + 1) % heroMovies.length);
    }, 5000);
    return () => clearInterval(t);
  }, [heroMovies.length]);

  // Recent browsing (views + searches)
  const [recentViews, setRecentViews] = useState<{ id: number; title: string; poster_path: string | null }[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  useEffect(() => {
    try {
      const rv = localStorage.getItem("recent_views");
      if (rv) setRecentViews((JSON.parse(rv) as Array<{ id: number; title: string; poster_path: string | null; ts?: number }>).map(({ id, title, poster_path }) => ({ id, title, poster_path })));
      const rs = localStorage.getItem("recent_searches");
      if (rs) {
        const list: Array<{ q: string; ts: number }> = JSON.parse(rs);
        const cutoff = Date.now() - 15 * 24 * 60 * 60 * 1000;
        const pruned = list.filter((x) => x.ts >= cutoff).map((x) => x.q);
        setRecentSearches(pruned);
        if (pruned.length !== list.length) {
          localStorage.setItem("recent_searches", JSON.stringify(list.filter((x) => x.ts >= cutoff)));
        }
      }
    } catch {}
  }, []);

  // Pagination handlers
  const handlePageChange = useCallback((page: number) => {
    // Validate page number before changing
    if (page < 1 || page > totalPages) {
      console.warn('⚠️ Invalid page number:', page, 'Total pages:', totalPages);
      return;
    }
    
    // Only change page if it's different
    if (page !== currentPage) {
      console.log('📄 Changing to page:', page);
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage, totalPages]);

  

  // Optimized event handlers
  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCategory("trending");
    setQuery("");
    setInputValue("");
    setResults([]);
    setTotalResults(0);
    setTotalPages(1);
    setShowNoResults(false);
    setIsActorMode(false);
    setSelectedActorName(null);
    setActorAllMovies([]);
    setActorQueryAtActivation(null);
    router.replace("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [router]);

  const handleCategoryChange = useCallback((next: "trending" | "popular" | "top_rated" | "upcoming" | "anime") => {
    setCategory(next);
    setQuery("");
    setInputValue("");
    setResults([]);
    setTotalResults(0);
    setTotalPages(1);
    setShowNoResults(false);
    setIsActorMode(false);
    setSelectedActorName(null);
    setActorAllMovies([]);
    setActorQueryAtActivation(null);
    router.replace("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [router]);

  // Prefetch movie route on hover/focus to make navigation feel instant
  const handlePrefetchMovie = useCallback((id: number) => {
    try { router.prefetch(`/movie/${id}`); } catch {}
  }, [router]);

  return (
    <>
      <LoadingScreen isLoading={showLoadingScreen} />
      <motion.div 
        className="min-h-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: isInitialLoad ? 0 : 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
          style={{ willChange: 'auto' }}
      >
  <header className={`md:sticky top-0 z-[9999] transition-transform duration-300 bg-black/70 ${scrollDir === "down" ? "md:-translate-y-full" : "md:translate-y-0"}`} style={{ willChange: 'auto' }}>
        <div className="mx-auto max-w-7xl px-0 py-2">
            <div className="mx-3 sm:mx-4 md:mx-6 lg:mx-8 flex flex-wrap items-center gap-2 sm:gap-4 rounded-2xl border border-white/10 bg-black/60 px-3 sm:px-4 py-1.5 sm:py-3">
            
            <Link href="/" onClick={handleLogoClick} className="flex items-center gap-2 text-sm sm:text-lg font-semibold tracking-tight shrink-0">
              <Image src="/movrex.svg" alt="Movrex" width={20} height={20} priority className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-sm sm:text-base"><span className="text-[--color-primary]">Mov</span>rex</span>
            </Link>
            <div ref={searchBoxRef} className="w-full sm:w-auto order-2 sm:order-none sm:basis-auto mt-2 sm:mt-0 ml-0 sm:ml-2 relative max-w-full sm:max-w-sm md:max-w-lg flex-none sm:flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 sm:size-5 text-white/60" />
              <input
                  placeholder="Search movies or actors..."
                value={inputValue}
                onChange={(e) => {
                  const next = e.target.value;
                  setInputValue(next);
                  setAreSuggestionsVisible(true);
                  setSuppressSuggestions(false);

                  // Debounce committing the typed value to `query` and updating URL
                  if (urlUpdateTimeoutRef.current) clearTimeout(urlUpdateTimeoutRef.current as NodeJS.Timeout);
                  urlUpdateTimeoutRef.current = setTimeout(() => {
                    const committed = next.trim();
                    const url = committed ? `/?q=${encodeURIComponent(committed)}` : "/";
                    try { router.replace(url); } catch {}
                    // update the debounced query used by heavy search logic
                    setQuery(committed);
                    // Reset pagination when a new query is committed
                    setCurrentPage(1);
                  }, 500);
                }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'NumpadEnter') {
                      // Immediately commit on Enter
                      if (urlUpdateTimeoutRef.current) clearTimeout(urlUpdateTimeoutRef.current as NodeJS.Timeout);
                      const committed = inputValue.trim();
                      const url = committed ? `/?q=${encodeURIComponent(committed)}` : "/";
                      try { router.replace(url); } catch {}
                      setQuery(committed);
                      setPersonSuggestions([]);
                      setAreSuggestionsVisible(false);
                      setSuppressSuggestions(true);
                      setCurrentPage(1);
                    } else if (e.key === 'Escape' && personSuggestions.length > 0) {
                      e.preventDefault();
                      setPersonSuggestions([]);
                      setAreSuggestionsVisible(false);
                    }
                  }}
                  className="w-full rounded-xl bg-white/10 border border-white/20 pl-10 sm:pl-11 pr-8 sm:pr-20 py-2 sm:py-2 outline-none focus:ring-2 focus:ring-white/30 hover:border-white/40 focus:border-white/50 transition-all duration-300 text-sm sm:text-base placeholder:text-white/50 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] focus:shadow-[0_0_25px_rgba(255,255,255,0.15)] focus:shadow-[0_0_35px_rgba(255,255,255,0.1)]"
                />
                {inputValue && (
                  <button
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      setInputValue("");
                      setIsActorMode(false);
                      setSelectedActorName(null);
                      setActorAllMovies([]);
                      setActorQueryAtActivation(null);
                      setResults([]);
                      setTotalResults(0);
                      setTotalPages(1);
                      setShowNoResults(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                  >
                    Clear
                  </button>
                )}
                {areSuggestionsVisible && personSuggestions.length > 0 && inputValue.trim() && (
                  <div className="absolute left-0 top-full mt-2 z-[10000] w-full sm:max-w-sm md:max-w-lg">
                    <div className="rounded-xl border border-white/20 bg-black/95 backdrop-blur-md p-2 shadow-2xl w-full">
                      <ul className="max-h-64 overflow-y-auto divide-y divide-white/10">
                        {personSuggestions.map((p) => (
                          <li key={p.id}>
                            <button
                              onClick={() => {
                                const committed = p.name;
                                setQuery(committed);
                                setInputValue(committed);
                                setPersonSuggestions([]);
                                setCurrentPage(1);
                                setAreSuggestionsVisible(false);
                                setSuppressSuggestions(true);
                                try { router.replace(`/?q=${encodeURIComponent(committed)}`); } catch {}
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-white/10 focus:bg-white/10 rounded-lg flex items-center justify-between gap-3"
                            >
                              <span className="text-sm text-white/90">{p.name}</span>
                              <span className="text-xs text-white/50">Search</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
            </div>
            {(query.trim() || filtersOpen) && (
              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className="order-1 sm:order-none ml-auto sm:ml-2 rounded-full px-3 py-1.5 text-sm border transition bg-white/5 text-white/90 border-white/10 hover:bg-white/10"
              >
                {filtersOpen ? 'Close Filters' : 'Filters'}
              </button>
            )}
            <nav className="hidden md:flex items-center gap-1 ml-2 sm:ml-4">
              {([
                { key: "trending", label: "Trending" },
                { key: "popular", label: "Popular" },
                { key: "top_rated", label: "Top Rated" },
                { key: "upcoming", label: "Upcoming" },
                { key: "anime", label: "Anime" },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleCategoryChange(tab.key)}
                  className={`rounded-full px-3 py-1.5 text-sm border transition ${
                    category === tab.key
                      ? "bg-white text-black border-white"
                      : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
            <nav className="md:hidden order-3 mt-2 px-3 sm:px-4 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 w-max pb-1">
              {([
                { key: "trending", label: "Trending" },
                { key: "popular", label: "Popular" },
                { key: "top_rated", label: "Top Rated" },
                { key: "upcoming", label: "Upcoming" },
                { key: "anime", label: "Anime" },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleCategoryChange(tab.key)}
                    className={`rounded-full px-3 py-1.5 text-xs sm:text-sm border transition-all duration-200 ${
                    category === tab.key
                        ? "bg-white text-black border-white shadow-lg"
                        : "bg-white/10 text-white/90 border-white/20 hover:bg-white/20 hover:border-white/30"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

        <main className="mx-auto max-w-7xl px-4 py-8 cv-auto">
          {filtersOpen && (
            <div className="mb-6 rounded-2xl border border-white/10 bg-black/30 backdrop-blur p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Search for</label>
                  <div className="inline-flex rounded-lg overflow-hidden border border-white/20">
                    <button
                      onClick={() => setFilters((f) => ({ ...f, searchType: "movie" }))}
                      className={`${(filters.searchType ?? "movie") === "movie" ? 'bg-white text-black' : 'bg-white/10 text-white/80 hover:bg-white/20'} px-3 py-2 text-sm`}
                    >
                      Movies
                    </button>
                    <button
                      onClick={() => setFilters((f) => ({ ...f, searchType: "actor" }))}
                      className={`${filters.searchType === "actor" ? 'bg-white text-black' : 'bg-white/10 text-white/80 hover:bg-white/20'} px-3 py-2 text-sm`}
                    >
                      Actor
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Sort by</label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value }))}
                    className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 outline-none focus:ring-2 focus:ring-white/30 text-white [&>option]:bg-gray-800 [&>option]:text-white [&>option:hover]:bg-gray-700 [&>option:focus]:bg-gray-700"
                  >
                    <option value="popularity.desc">Popularity ↓</option>
                    <option value="popularity.asc">Popularity ↑</option>
                    <option value="vote_average.desc">Rating ↓</option>
                    <option value="vote_average.asc">Rating ↑</option>
                    <option value="primary_release_date.desc">Release date ↓</option>
                    <option value="primary_release_date.asc">Release date ↑</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => {
                    setFiltersActive(true);
                    if ((filters.searchType ?? 'movie') === 'actor' && query.trim()) {
                      // actor mode will be resolved when applying
                    } else {
                      setIsActorMode(false);
                      setSelectedActorName(null);
                      setActorAllMovies([]);
                    }
                    setResults([]);
                    setCurrentPage(1);
                  }}
                  className="rounded-lg bg-white text-black px-4 py-2 text-sm hover:bg-white/90"
                >
                  Apply filters
                </button>
                <button
                  onClick={() => {
                    setFilters((f) => ({ ...f, sortBy: 'popularity.desc', searchType: 'movie' }));
                    setFiltersActive(false);
                    setIsActorMode(false);
                    setSelectedActorName(null);
                    setActorAllMovies([]);
                    setResults([]);
                    setTotalResults(0);
                    setTotalPages(1);
                    setCurrentPage(1);
                    setShowNoResults(false);
                  }}
                  className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          {!query && heroMovies.length > 0 && (
          <motion.section
              initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative mb-10 overflow-hidden rounded-2xl border border-white/10 group"
          >
              <div className="relative h-[50vh] sm:h-[62vh] md:h-[68vh] lg:aspect-[16/9] lg:h-auto">
                {/* Hero Carousel Images (best 3) */}
                {heroMovies.map((movie, index) => (
                <motion.div
                    key={movie.id}
                  className="absolute inset-0"
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ 
                      opacity: index === currentHeroIndex ? 1 : 0,
                      scale: index === currentHeroIndex ? 1 : 1.05
                    }}
                    transition={{ 
                      duration: 0.8, 
                      ease: "easeInOut"
                    }}
                  >
                    {movie.backdrop_path || movie.poster_path ? (
          <Image
                        src={TMDB.img(movie.backdrop_path || movie.poster_path || "", "w1280")}
            alt={movie.title || movie.name || "Featured"}
          fill
          sizes="100vw"
          className="object-cover"
            priority={index === 0}
            loading={index === 0 ? "eager" : "lazy"}
          />
              ) : (
                <div className="absolute inset-0 grid place-content-center text-white/40">
                  No preview
                </div>
              )}
                  </motion.div>
                ))}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
              />
            </div>

            <div className="absolute inset-0 flex items-end">
              <motion.div 
                  key={heroMovies[currentHeroIndex]?.id}
                  className="p-4 sm:p-6 md:p-10 max-w-full sm:max-w-2xl"
                  initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              >
                <motion.h1 
                    className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight leading-tight"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: 0.45, ease: "easeOut" }}
                >
                    {heroMovies[currentHeroIndex]?.title || heroMovies[currentHeroIndex]?.name}
                </motion.h1>
                <motion.p 
                    className="mt-2 text-white/90 line-clamp-2 sm:line-clamp-3 text-sm sm:text-base"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: 0.55, ease: "easeOut" }}
                >
                    {heroMovies[currentHeroIndex]?.overview}
                </motion.p>
                <motion.div 
                    className="mt-3 sm:mt-4 flex items-center gap-2 sm:gap-3"
                    initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6, ease: "easeOut" }}
                >
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Link
                        href={`/movie/${heroMovies[currentHeroIndex]?.id}`}
                        className="inline-flex items-center gap-2 rounded-full bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-700 transition-colors shadow-lg drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]"
                        onMouseEnter={() => { const id = heroMovies[currentHeroIndex]?.id; if (typeof id === 'number') handlePrefetchMovie(id); }}
                        onFocus={() => { const id = heroMovies[currentHeroIndex]?.id; if (typeof id === 'number') handlePrefetchMovie(id); }}
                    >
                        <Info className="size-4" /> View Details
                    </Link>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                      <button
                        onClick={() => setCurrentHeroIndex((prev) => (prev + 1) % heroMovies.length)}
                        className="inline-flex items-center gap-2 rounded-full bg-white/20 border border-white/30 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30 transition-colors"
                      >
                        <ArrowRight className="size-4" /> Next
                      </button>
                    </motion.div>
                </motion.div>
              </motion.div>
            </div>
          </motion.section>
        )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          className="mb-6"
        >
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            {filtersActive ? 'Filtered results' : (query ? "Search results" : `${category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')} this week`)}
          </h2>
            {isActorMode && selectedActorName && (
              <div className="mt-1 text-white/60 text-sm flex items-center gap-3">
                <span>
                  Showing movies featuring <span className="text-white">{selectedActorName}</span>
                </span>
                <button onClick={clearActorFilter} className="text-xs rounded-md border border-white/15 px-2 py-1 text-white/70 hover:bg-white/10">Clear</button>
              </div>
            )}
            {loading && (
              <div className="mt-2 text-white/60 flex items-center justify-center gap-2" aria-live="polite">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/60"></div>
                Searching for movies...
              </div>
            )}
        </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4 stable-grid">
          {loading ? (
            // Show skeleton loaders while loading
            Array.from({ length: 18 }).map((_, i) => (
              <MovieCardSkeleton key={i} />
            ))
          ) : (
            rows.map((movie) => {
              // Validate movie object has required properties
              if (!movie || typeof movie !== 'object' || !movie.id) {
                console.warn('Invalid movie object:', movie);
                return null;
              }
              
              return (
                <article
                  key={movie.id}
                  className="group"
                >
                  <Link
                    href={query.trim() ? { pathname: `/movie/${movie.id}`, query: { q: query.trim() } } : `/movie/${movie.id}`}
                    className="block"
                    prefetch={true}
                    onMouseEnter={() => handlePrefetchMovie(movie.id)}
                    onFocus={() => handlePrefetchMovie(movie.id)}
                  >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                    {movie.poster_path ? (
          <Image
            src={TMDB.img(movie.poster_path, "w300")}
                        alt={movie.title || movie.name || "Movie"}
                        fill
                          sizes="(max-width: 640px) 33vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-content-center text-white/40 text-sm">
                        No image
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/80 rounded-full px-2 py-1 text-xs font-medium flex items-center gap-1">
                      <span className="text-yellow-400">★</span>
                      {(movie.vote_average ?? 0).toFixed(1)}
                    </div>
                  </div>
                  <div className="mt-2">
                    <h3 className="font-medium text-base line-clamp-2 group-hover:text-white/80 transition-colors">
                      {movie.title || movie.name}
                    </h3>
                    <p className="text-white/60 text-xs mt-1">
                      {movie.release_date?.split("-")[0] || movie.first_air_date?.split("-")[0] || "N/A"}
                    </p>
                  </div>
                </Link>
              </article>
            );
          }).filter(Boolean)
          )}
    </div>

          {/* Pagination Controls - Show for search or filters */}
          {(filtersActive || query) && totalPages > 1 && (
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="text-white/60 text-sm" aria-live="polite">
                Showing {((currentPage - 1) * moviesPerPage) + 1} to {Math.min(currentPage * moviesPerPage, totalResults)} of {totalResults} results
              </div>
              <div className="flex items-center gap-2">
                {/* Previous Page Button */}
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className={`px-3 py-2 rounded-lg border transition ${
                    currentPage <= 1
                      ? "border-white/20 text-white/40 cursor-not-allowed"
                      : "border-white/20 text-white/80 hover:bg-white/10"
                  }`}
                >
                  Previous
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    // Ensure page number is valid
                    if (pageNum < 1 || pageNum > totalPages) return null;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 rounded-lg border transition ${
                          currentPage === pageNum
                            ? "bg-white text-black border-white"
                            : "border-white/20 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                {/* Next Page Button */}
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className={`px-3 py-2 rounded-lg border transition ${
                    currentPage >= totalPages
                      ? "border-white/20 text-white/40 cursor-not-allowed"
                      : "border-white/20 text-white/80 hover:bg-white/10"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* No Results Message */}
          {(filtersActive || query) && results.length === 0 && !loading && (
            <div className="mt-8 text-center">
              <div className="text-white/60 text-lg mb-3">
                {filtersActive ? (
                  'No movies found for the selected filters'
                ) : (
                  <>🎬 No movies found for &quot;{query}&quot;</>
                )}
              </div>
              <div className="text-white/40 text-sm mb-4">
                {filtersActive ? (
                  'Try adjusting your filter criteria or search for something else'
                ) : (
                  'Try a different search term or check your spelling'
                )}
              </div>
              
              {/* Helpful suggestions for search */}
              {!filtersActive && query && (
                <div className="text-white/30 text-xs space-y-1">
                  <p>💡 Search tips:</p>
                  <p>• Use movie titles, actor names, or keywords</p>
                  <p>• Try shorter or more general terms</p>
                  <p>• Check for typos in your search</p>
                </div>
              )}
            </div>
          )}
      </main>
        
        {/* Continue browsing */}
        {(recentViews.length > 0 || recentSearches.length > 0) && (
          <section className="mx-auto max-w-7xl px-4 mt-2 cv-auto">
            <h3 className="text-lg font-semibold mb-2">Continue browsing</h3>
            <div className="flex flex-col gap-3">
              {recentViews.length > 0 && (
                <div>
                  <div className="text-sm text-white/60 mb-2">Recently viewed</div>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {recentViews.slice(0, 12).map((v) => (
                      <Link key={v.id} href={`/movie/${v.id}`} className="w-[110px] shrink-0" prefetch={true} onMouseEnter={() => handlePrefetchMovie(v.id)} onFocus={() => handlePrefetchMovie(v.id)}>
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-white/10 bg-gray-900">
                          {v.poster_path ? (
                            <Image src={TMDB.img(v.poster_path, 'w300')} alt={v.title} fill sizes="20vw" className="object-cover" />
                          ) : (
                            <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">No image</div>
                          )}
                        </div>
                        <div className="mt-1 text-xs line-clamp-2 text-white/80">{v.title}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {recentSearches.length > 0 && (
                <div>
                  <div className="text-sm text-white/60 mb-2">Recent searches</div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {recentSearches.slice(0, 10).map((q) => (
                      <Link
                        key={q}
                        href={`/?q=${encodeURIComponent(q)}`}
                        className="inline-flex h-8 items-center rounded-full border border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10 overflow-hidden whitespace-nowrap text-ellipsis max-w-[220px] shrink-0"
                        title={q}
                      >
                        {q}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Now trending mini-carousel */}
        {(Array.isArray(trending) && trending.length > 0) && (
          <section className="mx-auto max-w-7xl px-4 mt-6 mb-8 cv-auto">
            <h3 className="text-lg font-semibold mb-2">Now trending</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {trending.slice(0, 12).map((m) => (
                      <Link key={m.id} href={`/movie/${m.id}`} className="w-[110px] shrink-0" prefetch={true} onMouseEnter={() => handlePrefetchMovie(m.id)} onFocus={() => handlePrefetchMovie(m.id)}>
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-white/10 bg-gray-900">
                    {m.poster_path ? (
                      <Image src={TMDB.img(m.poster_path, 'w300')} alt={m.title || m.name || 'Movie'} fill sizes="20vw" className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">No image</div>
                    )}
                  </div>
                  <div className="mt-1 text-xs line-clamp-2 text-white/80">{m.title || m.name}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
        
        {/* No trending movies message */}
        {(!Array.isArray(trending) || trending.length === 0) && !query && !filtersActive && (
          <section className="mx-auto max-w-7xl px-4 mt-6 mb-8 cv-auto">
            <div className="text-center text-white/40">
              <p className="text-lg mb-2">🎬 Welcome to Movrex!</p>
              <p className="text-sm">Start searching for movies or browse trending content</p>
            </div>
          </section>
        )}

        {/* Footer is rendered globally via layout */}
      </motion.div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div />}> 
      <HomeContent />
    </Suspense>
  );
}