import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for trending movies (30 minutes TTL)
const cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

interface Movie {
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
}

interface TMDBResponse {
  results: Movie[];
  total_results: number;
  total_pages: number;
  page: number;
}

// Cache management functions
function getCachedData(key: string) {
  const cached = cache.get(key);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCachedData(key: string, data: unknown, ttl: number = CACHE_TTL) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, cached] of cache.entries()) {
    if (now - cached.timestamp > cached.ttl) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Check for abort signal (unused but kept for future use)
    // const { signal } = request;
    
    if (!TMDB_KEY) {
      return NextResponse.json(
        { error: 'TMDB API key not configured' },
        { status: 500 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'trending';
    const page = searchParams.get('page') || '1';
    const timeWindow = searchParams.get('timeWindow') || 'week';

    // Create cache key
    const cacheKey = `trending:${category}:${page}:${timeWindow}`;
    
    // Check cache first
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData, {
        headers: {
          'Cache-Control': 'public, max-age=1800, s-maxage=1800',
          'X-Cache': 'HIT',
        },
      });
    }

    // Build TMDB API URL and headers (prefer v4 token)
    let tmdbUrl: string;
    if (category === 'trending') {
      tmdbUrl = `${TMDB_BASE}/trending/movie/${timeWindow}?page=${page}`;
    } else {
      tmdbUrl = `${TMDB_BASE}/movie/${category}?page=${page}`;
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'Movrex/1.0',
    };

    if (TMDB_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${TMDB_ACCESS_TOKEN}`;
    } else if (TMDB_KEY) {
      // attach api_key as query param when no bearer token
      tmdbUrl += `&api_key=${TMDB_KEY}`;
    } else {
      return NextResponse.json({ error: 'TMDB API key not configured' }, { status: 500 });
    }

    // Fetch from TMDB with timeout and abort support
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(tmdbUrl, {
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status}`);
      }

      const data: TMDBResponse = await response.json();

      // Optimize the response data
      const optimizedData = {
        results: data.results.map(movie => ({
          id: movie.id,
          title: movie.title,
          name: movie.name,
          overview: movie.overview,
          poster_path: movie.poster_path,
          backdrop_path: movie.backdrop_path,
          vote_average: movie.vote_average,
          release_date: movie.release_date,
          first_air_date: movie.first_air_date,
          popularity: movie.popularity,
          vote_count: movie.vote_count,
        })),
        total_results: data.total_results,
        total_pages: data.total_pages,
        page: data.page,
        cached_at: new Date().toISOString(),
      };

      // Cache the optimized data
      setCachedData(cacheKey, optimizedData);

      return NextResponse.json(optimizedData, {
        headers: {
          'Cache-Control': 'public, max-age=1800, s-maxage=1800',
          'X-Cache': 'MISS',
          'Content-Type': 'application/json',
        },
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 408 }
        );
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('Trending API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch trending movies',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
