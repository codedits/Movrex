"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Play } from "lucide-react";

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
  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState<Movie[]>([]);
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${TMDB.base}/trending/movie/week?api_key=${TMDB.key}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => setTrending(d.results || []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 backdrop-blur glass">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            <span className="text-[--color-primary]">Mov</span>rex
          </Link>
          <div className="ml-auto relative w-full max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/60" />
            <input
              placeholder="Search movies..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 pl-11 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-white/20 transition"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition" />
              <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 group-hover:opacity-100 transition">
                <h3 className="text-sm font-medium truncate">
                  {m.title || m.name}
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white text-black px-3 py-1 text-xs font-medium/none">
                    <Play className="size-4" /> Details
                  </span>
                  <span className="text-xs text-white/70">★ {m.vote_average?.toFixed(1)}</span>
                </div>
              </div>
            </motion.article>
          ))}
        </section>
      </main>
    </div>
  );
}
