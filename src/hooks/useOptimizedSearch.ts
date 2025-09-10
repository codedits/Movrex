import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

interface SearchResult<T> {
  data: T[];
  total_results: number;
  total_pages: number;
  page: number;
}

interface UseOptimizedSearchOptions<T> {
  debounceMs?: number;
  cacheTimeout?: number;
  maxCacheSize?: number;
  onError?: (error: Error) => void;
  onSuccess?: (data: SearchResult<T>) => void;
}

// In-memory cache for search results
const searchCache = new Map<string, {
  data: SearchResult<unknown>;
  timestamp: number;
  ttl: number;
}>();

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_CACHE_SIZE = 100;

export function useOptimizedSearch<T>(
  searchFunction: (query: string, page: number, signal: AbortSignal) => Promise<SearchResult<T> | null>,
  options: UseOptimizedSearchOptions<T> = {}
) {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    cacheTimeout = DEFAULT_CACHE_TIMEOUT,
    maxCacheSize = DEFAULT_MAX_CACHE_SIZE,
    onError,
    onSuccess,
  } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cache management functions
  const getCachedResult = useCallback((cacheKey: string) => {
    const cached = searchCache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      searchCache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }, []);

  const setCachedResult = useCallback((cacheKey: string, data: SearchResult<T>) => {
    // Clean up cache if it's too large
    if (searchCache.size >= maxCacheSize) {
      const oldestKey = searchCache.keys().next().value;
      if (oldestKey) {
        searchCache.delete(oldestKey);
      }
    }

    searchCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: cacheTimeout,
    });
  }, [cacheTimeout, maxCacheSize]);

  // Debounced search function
  const debouncedSearch = useCallback(
    (searchQuery: string, page: number) => {
      // Clear previous timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Abort previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      // Set timeout for debounced search
      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          setLoading(true);
          setError(null);

          // Check cache first
          const cacheKey = `${searchQuery}:${page}`;
          const cachedData = getCachedResult(cacheKey);
          
                     if (cachedData) {
             setResults(cachedData.data as T[]);
             setTotalResults(cachedData.total_results);
             setTotalPages(cachedData.total_pages);
             setCurrentPage(cachedData.page);
             onSuccess?.(cachedData as SearchResult<T>);
             return;
           }

          // Perform search
          const searchResult = await searchFunction(
            searchQuery,
            page,
            abortControllerRef.current!.signal
          );

          if (searchResult) {
            setResults(searchResult.data);
            setTotalResults(searchResult.total_results);
            setTotalPages(searchResult.total_pages);
            setCurrentPage(searchResult.page);

            // Cache the result
            setCachedResult(cacheKey, searchResult);
            onSuccess?.(searchResult);
          } else {
            setResults([]);
            setTotalResults(0);
            setTotalPages(0);
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            // Request was aborted, ignore
            return;
          }

          const errorMessage = err instanceof Error ? err.message : 'Search failed';
          setError(errorMessage);
          onError?.(err instanceof Error ? err : new Error(errorMessage));
        } finally {
          setLoading(false);
        }
      }, debounceMs);
    },
    [searchFunction, debounceMs, getCachedResult, setCachedResult, onSuccess, onError]
  );

  // Search effect
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setTotalResults(0);
      setTotalPages(0);
      setCurrentPage(1);
      setError(null);
      return;
    }

    debouncedSearch(query, currentPage);
  }, [query, currentPage, debouncedSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Memoized search handlers
  const handleSearch = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setCurrentPage(1); // Reset to first page for new search
  }, []);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setTotalResults(0);
    setTotalPages(0);
    setCurrentPage(1);
    setError(null);
    
    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Memoized return values
  const searchState = useMemo(() => ({
    query,
    results,
    loading,
    error,
    totalResults,
    totalPages,
    currentPage,
  }), [query, results, loading, error, totalResults, totalPages, currentPage]);

  const searchActions = useMemo(() => ({
    handleSearch,
    handlePageChange,
    clearSearch,
  }), [handleSearch, handlePageChange, clearSearch]);

  return {
    ...searchState,
    ...searchActions,
  };
}

// Utility function to clear all cached search results
export const clearSearchCache = () => {
  searchCache.clear();
};

// Utility function to get cache statistics
export const getSearchCacheStats = () => {
  return {
    size: searchCache.size,
    keys: Array.from(searchCache.keys()),
  };
};
