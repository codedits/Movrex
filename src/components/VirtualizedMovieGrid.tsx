"use client";

import React, { memo, useMemo, useCallback, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

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
  img: (path: string, size: "w300" | "w500" | "w780" | "original" = "w500") =>
    `https://image.tmdb.org/t/p/${size}${path}`,
};

interface MovieCardProps {
  movie: Movie;
  onPrefetch?: (id: number) => void;
  query?: string;
}

// Optimized Movie Card Component
const MovieCard = memo<MovieCardProps>(({ movie, onPrefetch, query }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Simplified intersection observer
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
    rootMargin: '50px',
    skip: typeof window === 'undefined',
  });

  const handleImageLoad = useCallback(() => setImageLoaded(true), []);
  const handleImageError = useCallback(() => setImageError(true), []);
  const handleMouseEnter = useCallback(() => onPrefetch?.(movie.id), [movie.id, onPrefetch]);

  // Simplified link generation
  const movieLink = query?.trim() 
    ? { pathname: `/movie/${movie.id}`, query: { q: query.trim() } }
    : `/movie/${movie.id}`;

  const movieTitle = movie.title || movie.name || "Movie";
  const movieYear = movie.release_date?.split("-")[0] || movie.first_air_date?.split("-")[0] || "N/A";

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ 
        duration: 0.3, 
        ease: "easeOut" 
      }}
      className="group"
    >
      <Link
        href={movieLink}
        className="block"
        prefetch={true}
        onMouseEnter={handleMouseEnter}
        onFocus={handleMouseEnter}
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
          {movie.poster_path && !imageError ? (
            <>
              <Image
                src={TMDB.img(movie.poster_path, "w500")}
                alt={movieTitle}
                fill
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                className={`object-cover transition-all duration-300 ${
                  imageLoaded 
                    ? 'scale-100 group-hover:scale-105' 
                    : 'scale-110 blur-sm'
                }`}
                loading="lazy"
                onLoad={handleImageLoad}
                onError={handleImageError}
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
              />
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gray-800 animate-pulse" />
              )}
            </>
          ) : (
            <div className="absolute inset-0 grid place-content-center text-white/40 text-sm">
              No image
            </div>
          )}
          
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium flex items-center gap-1">
            <span className="text-yellow-400">★</span>
            {(movie.vote_average ?? 0).toFixed(1)}
          </div>
        </div>
        
  <div className="mt-2">
          <h3 className="font-medium text-base line-clamp-2 group-hover:text-white/80 transition-colors">
            {movieTitle}
          </h3>
          <p className="text-white/60 text-xs mt-1">
            {movieYear}
          </p>
          <div className="mt-2">
            <a
              href={`https://moviebox.ph/web/searchResult?keyword=${encodeURIComponent(movieTitle.replace(/\s+/g, '+'))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded"
            >
              Watch Now
            </a>
          </div>
        </div>
      </Link>
    </motion.article>
  );
});

MovieCard.displayName = 'MovieCard';

interface VirtualizedMovieGridProps {
  movies: Movie[];
  loading?: boolean;
  onPrefetch?: (id: number) => void;
  query?: string;
  className?: string;
}

// Skeleton loader component
const MovieCardSkeleton = memo(() => (
  <div className="animate-pulse">
    <div className="aspect-[2/3] bg-gray-800 rounded-lg mb-2"></div>
    <div className="h-4 bg-gray-800 rounded mb-1"></div>
    <div className="h-3 bg-gray-800 rounded w-2/3"></div>
  </div>
));

MovieCardSkeleton.displayName = 'MovieCardSkeleton';

// Optimized Virtualized Grid Component
const VirtualizedMovieGrid = memo<VirtualizedMovieGridProps>(({
  movies,
  loading = false,
  onPrefetch,
  query,
  className = ""
}) => {
  // Simplified grid classes
  const gridCols = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';

  // Simple prefetch handler
  const handlePrefetch = useCallback((id: number) => onPrefetch?.(id), [onPrefetch]);

  if (loading) {
    return (
      <div className={`grid ${gridCols} gap-2 sm:gap-3 md:gap-4 ${className}`}>
        {Array.from({ length: 18 }).map((_, i) => (
          <MovieCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid ${gridCols} gap-2 sm:gap-3 md:gap-4 ${className}`}>
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onPrefetch={handlePrefetch}
          query={query}
        />
      ))}
    </div>
  );
});

VirtualizedMovieGrid.displayName = 'VirtualizedMovieGrid';

export default VirtualizedMovieGrid;
