"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Search, Play, Info } from "lucide-react";
import useScrollDirection from "@/hooks/useScrollDirection";
import LoadingScreen from "@/components/LoadingScreen";
// Defer rarely-needed components
const MovieMasterChatLazy = dynamic(() => import("@/components/MovieMasterChat"), { ssr: false });

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
};

const TMDB = {
  base: "https://api.themoviedb.org/3",
  key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
  img: (path: string, size: "w300" | "w500" | "w780" | "original" = "w500") =>
    `https://image.tmdb.org/t/p/${size}${path}`,
};

const isDev = process.env.NODE_ENV === 'development';

// Simple in-memory caches (reset on reload)
type TMDBSearchResponse = { results?: Movie[]; total_results?: number; total_pages?: number } | null;
const searchCache = new Map<string, TMDBSearchResponse>(); // key: `${query}::${page}` -> full data
const personCache = new Map<string, { id: number; name: string }>(); // key: query -> person
const creditsCache = new Map<number, Movie[]>(); // key: personId -> movies

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
  const [trending, setTrending] = useState<Movie[]>([]);
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<"trending" | "popular" | "top_rated" | "upcoming">(
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
  const [personSuggestion, setPersonSuggestion] = useState<{ id: number; name: string } | null>(null);
  const [isActorMode, setIsActorMode] = useState(false);
  // const [selectedActorId, setSelectedActorId] = useState<number | null>(null);
  const [selectedActorName, setSelectedActorName] = useState<string | null>(null);
  const [actorAllMovies, setActorAllMovies] = useState<Movie[]>([]);
  const [actorQueryAtActivation, setActorQueryAtActivation] = useState<string | null>(null);

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
      const cacheKey = `${query}::${page}`;
      if (searchCache.has(cacheKey)) {
        if (isDev) console.log('⚡ cache hit (search):', cacheKey);
        return searchCache.get(cacheKey);
      }
      const movieEndpoint = `${TMDB.base}/search/movie?query=${encodeURIComponent(query)}&api_key=${TMDB.key}&page=${page}`;
      const movieRes = await fetch(movieEndpoint, { signal });
      if (!movieRes.ok) throw new Error('Failed to fetch movie search');
      const movieData = await movieRes.json();
      searchCache.set(cacheKey, movieData);
      return movieData;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return null;
      console.error('Search error:', error);
      return null;
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

  // If chat stored a pending query, hydrate it once on mount
  useEffect(() => {
    try {
      const pending = localStorage.getItem('mm_pending_query');
      if (pending) {
        setQuery(pending);
        setCurrentPage(1);
        localStorage.removeItem('mm_pending_query');
      }
    } catch {}
  }, []);

  // Sync `?q=` from URL into local query state (supports chat deep-links)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const q = (searchParams?.get("q") || "").trim();
    if (q !== query) {
      setQuery(q);
      setCurrentPage(1);
      // Exiting actor mode if URL-driven search arrives
      setIsActorMode(false);
      setSelectedActorName(null);
      setActorAllMovies([]);
      setPersonSuggestion(null);
    }
  }, [searchParams]);

  // Optimized category fetch (preload early for hero)
  useEffect(() => {
    if (query.trim()) return;
    
    const controller = new AbortController();
    const endpoint = category === "trending"
      ? `${TMDB.base}/trending/movie/week?api_key=${TMDB.key}`
      : `${TMDB.base}/movie/${category}?api_key=${TMDB.key}`;
    
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

  // Optimized search with debouncing
  useEffect(() => {
    if (isDev) console.log('🔍 Search effect triggered:', { query, currentPage, isActorMode });

    // When in actor mode, pause normal search logic
    if (isActorMode) {
      return;
    }

    if (!query || !query.trim()) {
      if (isDev) console.log('❌ Empty query, clearing results');
      setResults([]);
      setCurrentPage(1);
      setTotalPages(1);
      setTotalResults(0);
      setShowNoResults(false); // Hide no results message immediately
      setSelectedActorName(null);
      setActorAllMovies([]);
      setIsActorMode(false);
      return;
    }

    let controller: AbortController | null = null;
    const timeoutId = setTimeout(() => {
      if (isActorMode) return; // extra guard at execution time
      if (isDev) console.log('🚀 Starting search for:', query, 'page:', currentPage);
      setLoading(true);
      setShowNoResults(false); // Hide no results while loading
      controller = new AbortController();
      searchMovies(query, currentPage, controller.signal)
        .then((data) => {
          if (isDev) console.log('📊 Search data received:', data);
          if (data && data.results && Array.isArray(data.results)) {
            // Use results as they come from API (no sorting)
            if (isDev) console.log('🎯 Movies found:', data.results.length);
            setResults(data.results);
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
              const trimmed = query.trim();
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
            if (isDev) console.log('⚠️ No results in data:', data);
            setResults([]);
            setTotalResults(0);
            setTotalPages(1);
            setSelectedActorName(null);
            setIsActorMode(false);
            setActorAllMovies([]);
            // Delay showing no results message to prevent flickering
            setTimeout(() => setShowNoResults(true), 500);
          }
        })
        .catch((error) => {
          if (error instanceof Error && error.name === 'AbortError') {
            if (isDev) console.log('🔕 Search aborted');
            return;
          }
          console.error('❌ Search error:', error);
          setResults([]);
          setTotalResults(0);
          setTotalPages(1);
          setSelectedActorName(null);
          setIsActorMode(false);
          setActorAllMovies([]);
          // Delay showing no results message on error
          setTimeout(() => setShowNoResults(true), 500);
        })
        .finally(() => setLoading(false));
    }, 300); // debounce delay

    return () => {
      clearTimeout(timeoutId);
      if (controller) controller.abort();
    };
  }, [query, currentPage, searchMovies, isActorMode, moviesPerPage]);

  // Fetch person suggestion on query change (debounced)
  useEffect(() => {
    // If in actor mode, keep it active unless the user changes the query
    if (isActorMode) {
      if (actorQueryAtActivation !== null && query !== actorQueryAtActivation) {
        // User changed query: clear actor filter
        setIsActorMode(false);
        setSelectedActorName(null);
        setActorAllMovies([]);
        setActorQueryAtActivation(null);
        setCurrentPage(1);
      }
      return; // Do not fetch person suggestions while in actor mode
    }

    // Reset suggestion when query changes (outside actor mode)
    setPersonSuggestion(null);
    if (!query || !query.trim()) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const endpoint = `${TMDB.base}/search/person?query=${encodeURIComponent(query)}&api_key=${TMDB.key}`;
        if (personCache.has(query)) {
          const fromCache = personCache.get(query)!;
          setPersonSuggestion(fromCache);
          return;
        }
        const res = await fetch(endpoint, { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to fetch person suggestion');
        const data = await res.json();
        const first = data?.results?.[0];
        if (first && first.name) {
          const found = { id: first.id, name: first.name };
          personCache.set(query, found);
          setPersonSuggestion(found);
        } else {
          setPersonSuggestion(null);
        }
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          console.warn('Person suggestion error:', err);
        }
      }
    }, 300);
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [query, isActorMode, actorQueryAtActivation]);

  // Confirm actor selection -> fetch all movies, paginate client-side
  const handleConfirmActor = useCallback(async () => {
    if (!personSuggestion) return;
    setPersonSuggestion(null); // prevent suggestion from reappearing
    setLoading(true);
    try {
      let allMovies: Movie[] = creditsCache.get(personSuggestion.id) ?? [];
      if (allMovies.length === 0) {
        const creditsEndpoint = `${TMDB.base}/person/${personSuggestion.id}/movie_credits?api_key=${TMDB.key}`;
        const res = await fetch(creditsEndpoint);
        if (!res.ok) throw new Error('Failed to fetch person credits');
        const creditsData = await res.json();
        allMovies = Array.isArray(creditsData?.cast) ? creditsData.cast : [];
        creditsCache.set(personSuggestion.id, allMovies);
      }
      const uniqueById = new Map<number, Movie>();
      for (const m of allMovies) {
        if (m && typeof m.id === 'number' && !uniqueById.has(m.id)) {
          uniqueById.set(m.id, m);
        }
      }
      const uniqueMovies = Array.from(uniqueById.values());
      // selected actor id no longer stored; name used for display
      setSelectedActorName(personSuggestion.name);
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
  }, [personSuggestion, moviesPerPage, query]);

  const handleDismissSuggestion = useCallback(() => {
    setPersonSuggestion(null);
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
    // If we're searching, only show search results (never fall back to trending)
    if (query.trim()) {
      return Array.isArray(results) ? results : [];
    }
    // If not searching, show trending movies
    return Array.isArray(trending) ? trending.slice(0, moviesPerPage) : [];
  }, [query, results, trending]);
  
  const featured = useMemo(() => {
    if (query || !trending || trending.length === 0) return null;
    return trending[0];
  }, [query, trending]);

  // Hero carousel state
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const heroMovies = useMemo(() => {
    if (query || !trending || trending.length === 0) return [];
    return trending.slice(0, 5); // Show first 5 trending movies in carousel
  }, [query, trending]);

  // Auto-advance hero carousel
  useEffect(() => {
    if (heroMovies.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % heroMovies.length);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
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

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setCurrentPage(1); // Reset to first page when starting new search
  }, []);

  // Optimized event handlers
  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCategory("trending");
    setQuery("");
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

  const handleCategoryChange = useCallback((next: "trending" | "popular" | "top_rated" | "upcoming") => {
    setCategory(next);
    setQuery("");
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

  return (
    <>
      <LoadingScreen isLoading={showLoadingScreen} />
      <motion.div 
        className="min-h-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: isInitialLoad ? 0 : 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <header className={`sticky top-0 z-[9999] transition-transform duration-300 will-change-transform bg-black/20 backdrop-blur-sm ${scrollDir === "down" ? "-translate-y-full" : "translate-y-0"}`}>
          <div className="mx-auto max-w-7xl px-0 py-3">
            <div className="mx-3 sm:mx-4 md:mx-6 lg:mx-8 flex flex-wrap items-center gap-2 sm:gap-4 rounded-2xl border border-white/10 glass px-3 sm:px-4 py-2.5 sm:py-3">
              <Link href="/" onClick={handleLogoClick} className="flex items-center gap-2 text-lg sm:text-xl font-semibold tracking-tight shrink-0">
                <Image src="/movrex.svg" alt="Movrex" width={24} height={24} priority />
                <span><span className="text-[--color-primary]">Mov</span>rex</span>
              </Link>
              <div className="order-2 basis-full sm:order-none sm:basis-auto ml-0 sm:ml-auto relative w-full sm:w-auto max-w-full sm:max-w-sm md:max-w-lg pt-1 sm:pt-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/60" />
                <input
                  placeholder="Search movies or actors..."
                  value={query}
                  onChange={handleSearchChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && personSuggestion && !isActorMode) {
                      e.preventDefault();
                      handleConfirmActor();
                    } else if (e.key === 'Escape' && personSuggestion) {
                      e.preventDefault();
                      setPersonSuggestion(null);
                    }
                  }}
                  className="w-full rounded-xl bg-white/5 border border-white/10 pl-11 pr-10 py-2 outline-none focus:ring-2 focus:ring-white/20 transition text-sm sm:text-base"
                />
                {query && (
                  <button
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
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
                {personSuggestion && !isActorMode && query.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-[10000]">
                    <div className="rounded-xl border border-white/10 glass p-3 flex items-center justify-between gap-3">
                      <div className="text-sm text-white/80">
                        Show movies from &quot;<span className="text-white font-medium">{personSuggestion.name}</span>&quot;?
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={handleConfirmActor} className="px-3 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90">Show</button>
                        <button onClick={handleDismissSuggestion} className="px-3 py-1.5 rounded-lg border border-white/15 text-white/80 text-sm hover:bg-white/10">Dismiss</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <nav className="hidden md:flex items-center gap-1 ml-2 sm:ml-4">
                {([
                  { key: "trending", label: "Trending" },
                  { key: "popular", label: "Popular" },
                  { key: "top_rated", label: "Top Rated" },
                  { key: "upcoming", label: "Upcoming" },
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
            <nav className="md:hidden mt-2 px-3 sm:px-4 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 w-max">
                {([
                  { key: "trending", label: "Trending" },
                  { key: "popular", label: "Popular" },
                  { key: "top_rated", label: "Top Rated" },
                  { key: "upcoming", label: "Upcoming" },
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
              </div>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 cv-auto">
          {!query && heroMovies.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative mb-10 overflow-hidden rounded-2xl border border-white/10 group"
            >
              <div className="relative h-[62vh] sm:h-[68vh] md:aspect-[16/9] md:h-auto">
                {/* Hero Carousel Images */}
                {heroMovies.map((movie, index) => (
                  <motion.div
                    key={movie.id}
                    className="absolute inset-0"
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: index === currentHeroIndex ? 1 : 0,
                      scale: index === currentHeroIndex ? 1 : 1.05
                    }}
                    transition={{ 
                      duration: 0.8, 
                      ease: "easeInOut",
                      delay: index === currentHeroIndex ? 0 : 0.1
                    }}
                    whileHover={{ scale: 1.03 }}
                  >
                    {movie.backdrop_path || movie.poster_path ? (
                      <Image
                        src={TMDB.img(movie.backdrop_path || movie.poster_path || "", "original")}
                        alt={movie.title || movie.name || "Featured"}
                        fill
                        sizes="100vw"
                        className="object-cover"
                        priority={index === 0}
                        loading={index === 0 ? "eager" : "lazy"}
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-content-center text-white/40">
                        No preview
                      </div>
                    )}
                  </motion.div>
                ))}
                
                {/* Carousel Indicators */}
                {heroMovies.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {heroMovies.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentHeroIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          index === currentHeroIndex 
                            ? 'bg-white w-6' 
                            : 'bg-white/60'
                        }`}
                        aria-label={`Go to slide ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
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
                  className="p-6 sm:p-10 max-w-2xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                >
                  <motion.h1
                    className="text-2xl sm:text-3xl font-semibold tracking-tight"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: 0.45, ease: "easeOut" }}
                  >
                    {heroMovies[currentHeroIndex]?.title || heroMovies[currentHeroIndex]?.name}
                  </motion.h1>
                  <motion.p
                    className="mt-2 text-white/80 line-clamp-3"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: 0.55, ease: "easeOut" }}
                  >
                    {heroMovies[currentHeroIndex]?.overview}
                  </motion.p>
                  <motion.div
                    className="mt-4 flex gap-3"
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
                        className="inline-flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 transition-colors"
                      >
                        <Play className="size-4" /> Play
                      </Link>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Link
                        href={`/movie/${heroMovies[currentHeroIndex]?.id}`}
                        className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 transition-colors"
                      >
                        <Info className="size-4" /> More info
                      </Link>
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
              {query ? "Search results" : `${category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')} this week`}
            </h2>
            {isActorMode && selectedActorName && (
              <div className="mt-1 text-white/60 text-sm flex items-center gap-3">
                <span>
                  Showing movies featuring <span className="text-white">{selectedActorName}</span>
                </span>
                <button onClick={clearActorFilter} className="text-xs rounded-md border border-white/15 px-2 py-1 text-white/70 hover:bg-white/10">Clear</button>
              </div>
            )}
            {loading && <div className="mt-2 text-white/60" aria-live="polite">Loading...</div>}
          </motion.div>

          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {loading ? (
              // Show skeleton loaders while loading
              Array.from({ length: 18 }).map((_, i) => (
                <MovieCardSkeleton key={i} />
              ))
            ) : (
              rows.map((movie) => (
                <motion.article
                  key={movie.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="group"
                >
                  <Link href={`/movie/${movie.id}`} className="block">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                      {movie.poster_path ? (
                        <Image
                          src={TMDB.img(movie.poster_path, "w500")}
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
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        {movie.vote_average.toFixed(1)}
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
                </motion.article>
              ))
            )}
          </div>

          {/* Pagination Controls - Only show for search results */}
          {query && totalPages > 1 && (
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

          {/* No Results Message for Search */}
          {query && showNoResults && results.length === 0 && !loading && (
            <div className="mt-8 text-center">
              <div className="text-white/60 text-lg">
                No movies found for &quot;{query}&quot;
              </div>
              <div className="text-white/40 text-sm mt-2">
                Try a different search term or check your spelling
              </div>
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
                      <Link key={v.id} href={`/movie/${v.id}`} className="w-[110px] shrink-0">
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
                      <Link key={m.id} href={`/movie/${m.id}`} className="w-[110px] shrink-0">
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