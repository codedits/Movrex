"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Info } from "lucide-react";

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
  img: (path: string, size: "w300" | "w500" | "w780" | "original" = "w500") =>
    `https://image.tmdb.org/t/p/${size}${path}`,
};

interface HeroSectionProps {
  onMovieSelect?: (movieId: number) => void;
}

export default function HeroSection({ onMovieSelect }: HeroSectionProps) {
  const [heroMovies, setHeroMovies] = useState<Movie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Optimized fetch for hero movies
  useEffect(() => {
    const fetchHeroMovies = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!TMDB.key) {
          throw new Error("TMDB API key is not configured");
        }

        const response = await fetch(
          `${TMDB.base}/trending/movie/week?api_key=${TMDB.key}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch trending movies: ${response.status}`);
        }

        const data = await response.json();
        const movies: Movie[] = data.results || [];

        if (movies.length === 0) {
          throw new Error("No trending movies found");
        }

        // Simplified filtering - take first 3 movies with backdrop
        const heroMovies = movies
          .filter(movie => movie.backdrop_path && movie.overview)
          .slice(0, 3);

        if (heroMovies.length === 0) {
          throw new Error("No suitable movies for hero section");
        }

        setHeroMovies(heroMovies);
      } catch (err) {
        console.error("Error fetching hero movies:", err);
        setError(err instanceof Error ? err.message : "Failed to load hero movies");
      } finally {
        setLoading(false);
      }
    };

    fetchHeroMovies();
  }, []);

  // Auto-advance hero every 6 seconds
  useEffect(() => {
    if (heroMovies.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % heroMovies.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [heroMovies.length]);

  const handleWatchTrailer = () => {
    // This would typically open a modal with the trailer
    // For now, we'll just log the action
    const currentMovie = heroMovies[currentIndex];
    console.log("Watch trailer clicked for:", currentMovie?.title);
  };

  const handleViewDetails = () => {
    const currentMovie = heroMovies[currentIndex];
    if (currentMovie && onMovieSelect) {
      onMovieSelect(currentMovie.id);
    }
  };

  if (loading) {
    return (
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative mb-10 overflow-hidden rounded-2xl border border-white/10 bg-gray-900"
      >
        <div className="relative h-[50vh] sm:h-[62vh] md:h-[68vh] lg:aspect-[16/9] lg:h-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white/60">Loading hero content...</div>
          </div>
        </div>
      </motion.section>
    );
  }

  if (error || heroMovies.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative mb-10 overflow-hidden rounded-2xl border border-white/10 bg-gray-900"
      >
        <div className="relative h-[50vh] sm:h-[62vh] md:h-[68vh] lg:aspect-[16/9] lg:h-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white/60">
              <p className="text-lg mb-2">🎬</p>
              <p className="text-sm">Unable to load featured content</p>
            </div>
          </div>
        </div>
      </motion.section>
    );
  }

  const currentMovie = heroMovies[currentIndex];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative mb-10 overflow-hidden rounded-2xl border border-white/10 group"
    >
      {/* Hero Background */}
      <div className="relative h-[50vh] sm:h-[62vh] md:h-[68vh] lg:aspect-[16/9] lg:h-auto">
                 <AnimatePresence mode="wait">
           <motion.div
             key={currentMovie.id}
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             transition={{ duration: 0.6, ease: "easeInOut" }}
             className="absolute inset-0"
           >
            {currentMovie.backdrop_path ? (
              <Image
                src={TMDB.img(currentMovie.backdrop_path, "original")}
                alt={currentMovie.title || currentMovie.name || "Featured Movie"}
                fill
                sizes="100vw"
                className="object-cover"
                priority
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Optimized Gradient Overlay - No black fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="absolute inset-0 flex items-end">
                 <AnimatePresence mode="wait">
           <motion.div
             key={currentMovie.id}
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -20 }}
             transition={{ duration: 0.5, ease: "easeOut" }}
             className="p-4 sm:p-6 md:p-10 max-w-full sm:max-w-2xl lg:max-w-3xl"
           >
                         {/* Optimized Movie Title */}
             <motion.h1
               initial={{ opacity: 0, y: 30 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.5, ease: "easeOut" }}
               className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-white"
             >
               {currentMovie.title || currentMovie.name}
             </motion.h1>

             {/* Optimized Rating Badge */}
             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
               className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-sm font-medium"
             >
               <span className="text-yellow-400">★</span>
               <span className="text-white">
                 {currentMovie.vote_average.toFixed(1)}
               </span>
               <span className="text-white/70">
                 • {currentMovie.release_date?.split("-")[0] || currentMovie.first_air_date?.split("-")[0] || "N/A"}
               </span>
             </motion.div>

             {/* Optimized Movie Description */}
             <motion.p
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
               className="mt-4 text-white/90 line-clamp-3 sm:line-clamp-4 text-sm sm:text-base leading-relaxed"
             >
               {currentMovie.overview}
             </motion.p>

             {/* Optimized Action Buttons */}
             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
               className="mt-6 flex flex-wrap items-center gap-3"
             >
              {/* Watch Trailer Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleWatchTrailer}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-700 transition-all duration-200 shadow-lg drop-shadow-[0_0_15px_rgba(239,68,68,0.6)] hover:shadow-xl"
              >
                <Play className="size-4" />
                Watch Trailer
              </motion.button>

              {/* View Details Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleViewDetails}
                className="inline-flex items-center gap-2 rounded-full bg-white/20 border border-white/30 text-white px-4 py-2.5 text-sm font-medium hover:bg-white/30 transition-all duration-200 backdrop-blur-sm"
              >
                <Info className="size-4" />
                View Details
              </motion.button>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress Indicators */}
      {heroMovies.length > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-2">
          {heroMovies.map((_, index) => (
            <motion.div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex ? 'bg-white' : 'bg-white/30'
              }`}
              initial={{ scale: 0.8 }}
              animate={{ 
                scale: index === currentIndex ? 1.2 : 0.8,
                opacity: index === currentIndex ? 1 : 0.5
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      )}

      {/* Decorative Elements */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
        className="absolute top-4 right-4 hidden sm:block"
      >
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      </motion.div>
    </motion.section>
  );
}
