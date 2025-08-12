"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

export default function Home() {
  const scrollDir = useScrollDirection(6);
  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<Movie[]>([]);
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<"trending" | "popular" | "top_rated" | "upcoming">(
    "trending"
  );

  useEffect(() => {
    if (query.trim()) return; // when searching, skip category fetch
    const controller = new AbortController();
    const endpoint =
      category === "trending"
        ? `${TMDB.base}/trending/movie/week?api_key=${TMDB.key}`
        : `${TMDB.base}/movie/${category}?api_key=${TMDB.key}`;
    setLoading(true);
    fetch(endpoint, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setTrending(d.results || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [category, query]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const delay = setTimeout(() => {
      setLoading(true);
      fetch(
        `${TMDB.base}/search/movie?query=${encodeURIComponent(query)}&api_key=${TMDB.key}`
      )
        .then((r) => r.json())
        .then((d) => setResults(d.results || []))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(delay);
  }, [query]);

  const rows = useMemo(() => (results.length ? results : trending).slice(0, 18), [results, trending]);
  const featured = useMemo(() => (!query && trending.length ? trending[0] : null), [query, trending]);

  function handleLogoClick(e: React.MouseEvent) {
    e.preventDefault();
    setCategory("trending");
    setQuery("");
    setResults([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCategoryChange(next: "trending" | "popular" | "top_rated" | "upcoming") {
    setCategory(next);
    setQuery("");
    setResults([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen">
      <header className={`sticky top-0 z-20 transition-transform duration-300 ${scrollDir === "down" ? "-translate-y-full" : "translate-y-0"}`}>
        <div className="mx-auto max-w-7xl px-0 py-3">
          <div className="mx-3 sm:mx-4 md:mx-6 lg:mx-8 flex flex-wrap items-center gap-2 sm:gap-4 rounded-2xl border border-white/10 glass px-3 sm:px-4 py-2.5 sm:py-3">
            <Link href="/" onClick={handleLogoClick} className="flex items-center gap-2 text-lg sm:text-xl font-semibold tracking-tight shrink-0">
              <Image src="/movrex.svg" alt="Movrex" width={24} height={24} />
              <span><span className="text-[--color-primary]">Mov</span>rex</span>
            </Link>
            <div className="order-2 basis-full sm:order-none sm:basis-auto ml-0 sm:ml-auto relative w-full sm:w-auto max-w-full sm:max-w-sm md:max-w-lg pt-1 sm:pt-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/60" />
              <input
                placeholder="Search movies..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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
                  src={TMDB.img(featured.backdrop_path || featured.poster_path || "", "w780")}
                  alt={featured.title || featured.name || "Featured"}
                  fill
                  sizes="100vw"
                  className="object-cover"
                  priority
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
                    className="inline-flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90"
                  >
                    <Play className="size-4" /> Play
                  </Link>
                  <Link
                    href={`/movie/${featured.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                  >
                    <Info className="size-4" /> More info
                  </Link>
                </div>
              </div>
            </div>
          </motion.section>
        )}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 flex items-center justify-between"
        >
          <h2 className="text-lg text-white/80">
            {results.length ? "Search results" : "Trending this week"}
          </h2>
          {loading && <span className="text-sm text-white/50">Loading…</span>}
        </motion.div>

        {rows.length === 0 && !loading ? (
          <div className="text-white/70">No results found.</div>
        ) : null}

        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {rows.map((m, idx) => (
            <motion.article
              key={m.id}
              initial={{ opacity: 0, scale: 0.98, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: idx * 0.03, duration: 0.35 }}
              className="group relative overflow-hidden rounded-xl bg-[--color-card] border border-white/5 hover:border-white/15 transition cursor-pointer"
            >
              <Link
                href={`/movie/${m.id}`}
                className="absolute inset-0 z-10"
                aria-label={`View ${m.title || m.name || "movie"} details`}
              >
                <span className="sr-only">Open details</span>
              </Link>
              {m.poster_path ? (
                <Image
                  src={TMDB.img(m.poster_path, "w500")}
                  alt={m.title || m.name || "Movie"}
                  width={500}
                  height={750}
                  className="h-72 w-full object-cover"
                />
              ) : (
                <div className="h-72 w-full grid place-content-center text-white/40 text-sm">
                  No image
                </div>
              )}
              <div className="absolute left-2 top-2 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px]">
                <span className="text-yellow-400">★</span>
                <span className="ml-1 text-white/90">{m.vote_average?.toFixed(1)}</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition" />
              <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 group-hover:opacity-100 transition">
                <h3 className="text-sm font-medium truncate">
                  {m.title || m.name}
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white text-black px-3 py-1 text-xs font-medium/none">
                    <Play className="size-4" /> Details
                  </span>
                  <span className="text-xs"><span className="text-yellow-400">★</span> <span className="text-white/70">{m.vote_average?.toFixed(1)}</span></span>
                </div>
              </div>
            </motion.article>
          ))}
        </section>
      </main>
    </div>
  );
}
