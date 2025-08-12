"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, Play, Info } from "lucide-react";
import useScrollDirection from "@/hooks/useScrollDirection";

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

// Skeleton loader component
const MovieCardSkeleton = () => (
  <div className="animate-pulse">
    <div className="aspect-[2/3] bg-gray-800 rounded-lg mb-2"></div>
    <div className="h-4 bg-gray-800 rounded mb-1"></div>
    <div className="h-3 bg-gray-800 rounded w-2/3"></div>
  </div>
);

export default function Home() {
  const scrollDir = useScrollDirection(6);
  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<Movie[]>([]);
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<"trending" | "popular" | "top_rated" | "upcoming">(
    "trending"
  );

  // Memoized fetch function
  const fetchMovies = useCallback(async (endpoint: string, signal: AbortSignal) => {
    try {
      const response = await fetch(endpoint, { signal });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Fetch error:', error);
      return [];
    }
  }, []);

  // Optimized category fetch
  useEffect(() => {
    if (query.trim()) return;
    
    const controller = new AbortController();
    const endpoint = category === "trending"
      ? `${TMDB.base}/trending/movie/week?api_key=${TMDB.key}`
      : `${TMDB.base}/movie/${category}?api_key=${TMDB.key}`;
    
    setLoading(true);
    
    fetchMovies(endpoint, controller.signal)
      .then((movies) => {
        if (movies.length > 0) {
          setTrending(movies);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [category, query, fetchMovies]);

  // Optimized search with debouncing
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const delay = setTimeout(() => {
      setLoading(true);
      const endpoint = `${TMDB.base}/search/movie?query=${encodeURIComponent(query)}&api_key=${TMDB.key}`;
      
      fetchMovies(endpoint, new AbortController().signal)
        .then((movies) => {
          setResults(movies);
        })
        .finally(() => setLoading(false));
    }, 300); // Reduced debounce time

    return () => clearTimeout(delay);
  }, [query, fetchMovies]);

  // Memoized computed values
  const rows = useMemo(() => (results.length ? results : trending).slice(0, 18), [results, trending]);
  const featured = useMemo(() => (!query && trending.length ? trending[0] : null), [query, trending]);

  // Optimized event handlers
  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCategory("trending");
    setQuery("");
    setResults([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleCategoryChange = useCallback((next: "trending" | "popular" | "top_rated" | "upcoming") => {
    setCategory(next);
    setQuery("");
    setResults([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  return (
    <div className="min-h-screen">
      <header className={`sticky top-0 z-20 transition-transform duration-300 ${scrollDir === "down" ? "-translate-y-full" : "translate-y-0"}`}>
        <div className="mx-auto max-w-7xl px-0 py-3">
          <div className="mx-3 sm:mx-4 md:mx-6 lg:mx-8 flex flex-wrap items-center gap-2 sm:gap-4 rounded-2xl border border-white/10 glass px-3 sm:px-4 py-2.5 sm:py-3">
            <Link href="/" onClick={handleLogoClick} className="flex items-center gap-2 text-lg sm:text-xl font-semibold tracking-tight shrink-0">
              <Image src="/movrex.svg" alt="Movrex" width={24} height={24} priority />
              <span><span className="text-[--color-primary]">Mov</span>rex</span>
            </Link>
            <div className="order-2 basis-full sm:order-none sm:basis-auto ml-0 sm:ml-auto relative w-full sm:w-auto max-w-full sm:max-w-sm md:max-w-lg pt-1 sm:pt-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/60" />
              <input
                placeholder="Search movies..."
                value={query}
                onChange={handleSearchChange}
                className="w-full rounded-xl bg-white/5 border border-white/10 pl-11 pr-3 py-2 outline-none focus:ring-2 focus:ring-white/20 transition text-sm sm:text-base"
              />
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

      <main className="mx-auto max-w-7xl px-4 py-8">
        {!query && featured && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative mb-10 overflow-hidden rounded-2xl border border-white/10"
          >
            <div className="relative h-[62vh] sm:h-[68vh] md:aspect-[16/9] md:h-auto">
              {featured.backdrop_path || featured.poster_path ? (
                <Image
                  src={TMDB.img(featured.backdrop_path || featured.poster_path || "", "original")}
                  alt={featured.title || featured.name || "Featured"}
                  fill
                  sizes="100vw"
                  className="object-cover"
                  priority
                  quality={100}
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                />
              ) : (
                <div className="absolute inset-0 grid place-content-center text-white/40">
                  No preview
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            </div>

            <div className="absolute inset-0 flex items-end">
              <div className="p-6 sm:p-10 max-w-2xl">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  {featured.title || featured.name}
                </h1>
                <p className="mt-2 text-white/80 line-clamp-3">{featured.overview}</p>
                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/movie/${featured.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 transition-colors"
                  >
                    <Play className="size-4" /> Play
                  </Link>
                  <Link
                    href={`/movie/${featured.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 transition-colors"
                  >
                    <Info className="size-4" /> More info
                  </Link>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-6"
        >
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            {query ? "Search results" : `${category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')} this week`}
          </h2>
          {loading && <div className="mt-2 text-white/60">Loading...</div>}
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
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
      </main>
    </div>
  );
}
