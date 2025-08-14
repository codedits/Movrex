import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import MovieGallery from "@/components/MovieGallery";
import { FadeIn, ScaleIn } from "@/components/Reveal";
import RecentViewBeacon from "@/components/RecentViewBeacon";

type Movie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  runtime?: number;
  genres?: { id: number; name: string }[];
  spoken_languages?: { english_name: string; iso_639_1: string; name: string }[];
  production_companies?: { id: number; name: string; logo_path: string | null; origin_country: string }[];
  production_countries?: { iso_3166_1: string; name: string }[];
  popularity?: number;
  belongs_to_collection?: { id: number; name: string; poster_path: string | null; backdrop_path: string | null } | null;
  images?: {
    posters?: { file_path: string; width: number; height: number }[];
    backdrops?: { file_path: string; width: number; height: number }[];
  };
  videos?: { results: { key: string; name: string; site: string; type: string }[] };
  credits?: {
    cast: { id: number; name: string; character?: string; profile_path: string | null }[];
    crew: { id: number; name: string; job: string }[];
  };
  keywords?: { keywords?: { id: number; name: string }[]; results?: { id: number; name: string }[] };
  recommendations?: { results: Movie[] };
};

const TMDB = {
  base: "https://api.themoviedb.org/3",
  key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
  img: (path: string, size: "w185" | "w342" | "w500" | "w780" | "original" = "w780") =>
    `https://image.tmdb.org/t/p/${size}${path}`,
};

// Constants for repeated blur data URLs
const BLUR_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==";



// Watch providers (where to watch)
type Provider = { provider_id: number; provider_name: string; logo_path: string | null };
type RegionProviders = {
  link?: string;
  flatrate?: Provider[];
  rent?: Provider[];
  buy?: Provider[];
};

async function fetchWatchProviders(movieId: string): Promise<{ region: string; data: RegionProviders } | null> {
  try {
    const url = `${TMDB.base}/movie/${movieId}/watch/providers?api_key=${TMDB.key}`;
    const res = await fetch(url, { next: { revalidate: 60 * 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    const results = json?.results || {};
    const regionPreference = ["US", "GB", "IN", "CA", "AU", "DE", "FR"];
    const region = regionPreference.find((r) => results[r]) || Object.keys(results)[0];
    if (!region) return null;
    const regionData: RegionProviders = results[region] || {};
    return { region, data: regionData };
  } catch (e) {
    console.error('watch/providers error', e);
    return null;
  }
}

// Fetch collection parts if the movie belongs to a collection
async function fetchCollectionParts(collectionId: number): Promise<Movie[]> {
  try {
    const url = `${TMDB.base}/collection/${collectionId}?api_key=${TMDB.key}&language=en-US`;
    const res = await fetch(url, { next: { revalidate: 60 * 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    const parts = Array.isArray(json?.parts) ? json.parts : [];
    return parts as Movie[];
  } catch (e) {
    console.error('collection parts error', e);
    return [];
  }
}

// Loading component
const MovieDetailSkeleton = () => (
  <div className="mx-auto max-w-6xl px-4 py-8 animate-pulse">
    <div className="h-6 bg-gray-800 rounded w-20 mb-6"></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="aspect-[2/3] bg-gray-800 rounded-xl"></div>
      <div className="md:col-span-2 space-y-4">
        <div className="h-8 bg-gray-800 rounded w-3/4"></div>
        <div className="h-4 bg-gray-800 rounded w-1/2"></div>
        <div className="h-4 bg-gray-800 rounded w-full"></div>
        <div className="h-4 bg-gray-800 rounded w-2/3"></div>
      </div>
    </div>
  </div>
);

async function fetchMovie(id: string): Promise<Movie> {
  const url = `${TMDB.base}/movie/${id}?api_key=${TMDB.key}&append_to_response=credits,videos,images,keywords,recommendations&include_image_language=en,null`;
  
  const res = await fetch(url, { 
    next: { revalidate: 60 * 60 }, // Cache for 1 hour
    headers: {
      'Accept': 'application/json',
    }
  });
  
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Movie not found');
    } else if (res.status === 401) {
      throw new Error('API key invalid');
    } else if (res.status >= 500) {
      throw new Error('Server error, please try again later');
    } else {
      throw new Error(`Failed to fetch movie: ${res.status}`);
    }
  }
  
  return res.json();
}

//

export default async function MovieDetail({ params, searchParams }: { params: Promise<{ id: string }>, searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = (await (searchParams || Promise.resolve({}))) as Record<string, string | string[] | undefined>;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  
  let movie: Movie;
  try {
    movie = await fetchMovie(id);
  } catch {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link href={q ? `/?q=${encodeURIComponent(q)}` : "/"} className="text-white/70 hover:text-white transition-colors">← Back</Link>
        <div className="mt-6 text-center">
          <p className="text-white/70 text-lg">Failed to load movie.</p>
          <p className="text-white/50 text-sm mt-2">Please try again later.</p>
        </div>
      </div>
    );
  }

  const directors = movie.credits?.crew.filter((c) => c.job === "Director") || [];
  const ytTrailer = movie.videos?.results.find((v) => v.site === "YouTube" && v.type === "Trailer");
  const keywords = (movie.keywords?.keywords || movie.keywords?.results || []) as { id: number; name: string }[];
  const cast = (movie.credits?.cast || []).slice(0, 12);
  const recs = movie.recommendations?.results?.slice(0, 12) || [];
  const posters = movie.images?.posters?.slice(0, 12) || [];
  const backdrops = movie.images?.backdrops?.slice(0, 12) || [];
  // Fetch additional data in parallel now that we have the movie (for region and collection)
  const [watch, collectionParts] = await Promise.all([
    fetchWatchProviders(id),
    movie.belongs_to_collection?.id ? fetchCollectionParts(movie.belongs_to_collection.id) : Promise.resolve([] as Movie[]),
  ]);

  // Build collection movies (exclude current movie). If none, section will not render.
  const collectionMovies = (collectionParts || [])
    .filter((m) => m && m.id !== movie.id);

  return (
    <Suspense fallback={<MovieDetailSkeleton />}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Record recent view in localStorage */}
        <RecentViewBeacon id={movie.id} title={movie.title} posterPath={movie.poster_path} />
        <Link href={q ? `/?q=${encodeURIComponent(q)}` : "/"} className="text-white/70 hover:text-white transition-colors">← Back</Link>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {movie.poster_path && (
            <ScaleIn>
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10">
                <Image
                  src={TMDB.img(movie.poster_path, "w780")}
                  alt={movie.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                  priority
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                />
              </div>
            </ScaleIn>
          )}

          <div className="md:col-span-2">
            <FadeIn>
              <h1 className="text-3xl font-semibold tracking-tight">{movie.title}</h1>
              <div className="mt-2 text-white/70 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
                <span><span className="text-yellow-400">★</span> {movie.vote_average?.toFixed(1)}</span>
                {movie.release_date && <span>· {movie.release_date?.slice(0, 4)}</span>}
                {movie.runtime && <span>· {movie.runtime} min</span>}
                {movie.popularity && <span>· Popularity {Math.round(movie.popularity)}</span>}
              </div>
            </FadeIn>

            {movie.genres && movie.genres.length > 0 && (
              <FadeIn delay={0.05}>
                <div className="mt-3 flex flex-wrap gap-2">
                  {movie.genres.map((g) => (
                    <span key={g.id} className="rounded-full bg-white/10 border border-white/10 px-2 py-1 text-xs text-white/80">
                      {g.name}
                    </span>
                  ))}
                </div>
              </FadeIn>
            )}

            <FadeIn delay={0.1}>
              <p className="mt-4 text-white/80 leading-relaxed max-w-prose">{movie.overview}</p>
            </FadeIn>

            <FadeIn delay={0.12}>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-white/80">
              <div>
                <h3 className="font-semibold text-white mb-2">Details</h3>
                <div className="space-y-1">
                  {movie.release_date && (
                    <p><span className="text-white/60">Release Date:</span> {new Date(movie.release_date).toLocaleDateString()}</p>
                  )}
                  {movie.runtime && (
                    <p><span className="text-white/60">Runtime:</span> {movie.runtime} minutes</p>
                  )}
                  {movie.spoken_languages && movie.spoken_languages.length > 0 && (
                    <p><span className="text-white/60">Languages:</span> {movie.spoken_languages.map(l => l.english_name).join(", ")}</p>
                  )}
                  {directors.length > 0 && (
                    <p><span className="text-white/60">Director{directors.length > 1 ? 's' : ''}:</span> {directors.map(d => d.name).join(", ")}</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-white mb-2">Production</h3>
                <div className="space-y-1">
                  {movie.production_companies && movie.production_companies.length > 0 && (
                    <p><span className="text-white/60">Companies:</span> {movie.production_companies.map(c => c.name).join(", ")}</p>
                  )}
                  {movie.production_countries && movie.production_countries.length > 0 && (
                    <p><span className="text-white/60">Countries:</span> {movie.production_countries.map(c => c.name).join(", ")}</p>
                  )}
                </div>
              </div>
            </div>
            </FadeIn>

            {watch?.data && (watch.data.flatrate || watch.data.rent || watch.data.buy) && (
              <FadeIn>
              <section className="mt-6">
                <h3 className="font-semibold text-white mb-3">Where to watch{watch?.region ? ` · ${watch.region}` : ''}</h3>
                <div className="flex flex-wrap gap-2">
                  {([['Stream', 'flatrate'] as const, ['Rent', 'rent'] as const, ['Buy', 'buy'] as const] as const).map(([label, key]) => {
                    const list = (watch.data?.[key as keyof RegionProviders] as Provider[] | undefined) || [];
                    if (!list || list.length === 0) return null;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-white/60">{label}:</span>
                        <div className="flex items-center gap-2">
                          {list.slice(0, 6).map((p) => (
                            <a
                              key={`${key}-${p.provider_id}`}
                              href={watch.data.link || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-1 hover:bg-white/10 transition text-xs"
                              title={`${label} on ${p.provider_name}`}
                            >
                              {p.logo_path ? (
                                <Image src={TMDB.img(p.logo_path, 'w185')} alt={p.provider_name} width={18} height={18} className="rounded" />
                              ) : (
                                <span className="w-[18px] h-[18px] grid place-content-center">🎬</span>
                              )}
                              <span className="hidden sm:inline text-white/80">{p.provider_name}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {watch.data.link && (
                    <a href={watch.data.link} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs underline text-white/70 hover:text-white">More providers</a>
                  )}
                </div>
              </section>
              </FadeIn>
            )}

            {ytTrailer && (
              <FadeIn>
              <div className="mt-6">
                <h3 className="font-semibold text-white mb-3">Trailer</h3>
                <a
                  href={`https://www.youtube.com/watch?v=${ytTrailer.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  Watch Trailer
                </a>
              </div>
              </FadeIn>
            )}
          </div>
        </div>

        {cast.length > 0 && (
          <FadeIn>
          <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-6">Cast</h2>
            {/* Mobile: Horizontal scroll, Desktop: Grid */}
            <div className="block sm:hidden">
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {cast.map((person) => (
                  <ScaleIn key={person.id}>
                  <div className="text-center w-[120px] shrink-0">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900 mb-2">
                      {person.profile_path ? (
                        <Image
                          src={TMDB.img(person.profile_path, "w342")}
                          alt={person.name}
                          fill
                          sizes="120px"
                          className="object-cover"
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL={BLUR_DATA_URL}
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">
                          No image
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium line-clamp-2">{person.name}</p>
                    {person.character && (
                      <p className="text-xs text-white/60 line-clamp-2">{person.character}</p>
                    )}
                  </div>
                  </ScaleIn>
                ))}
              </div>
            </div>
            {/* Desktop Grid */}
            <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {cast.map((person) => (
                <ScaleIn key={person.id}>
                <div className="text-center">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900 mb-2">
                    {person.profile_path ? (
                      <Image
                        src={TMDB.img(person.profile_path, "w342")}
                        alt={person.name}
                        fill
                        sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                        className="object-cover"
                        loading="lazy"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">
                        No image
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium">{person.name}</p>
                  {person.character && (
                    <p className="text-xs text-white/60">{person.character}</p>
                  )}
                </div>
                </ScaleIn>
              ))}
            </div>
          </section>
          </FadeIn>
        )}

        {(posters.length > 0 || backdrops.length > 0) && (
          <FadeIn>
          <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-6">Gallery</h2>
            <MovieGallery 
              images={[
                ...backdrops.map((b) => ({ src: TMDB.img(b.file_path, "w780"), alt: "Backdrop" })),
                ...posters.map((p) => ({ src: TMDB.img(p.file_path, "w780"), alt: "Poster" })),
              ]}
            />
          </section>
          </FadeIn>
        )}

        {keywords.length > 0 && (
          <FadeIn>
          <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-6">Keywords</h2>
            <div className="flex flex-wrap gap-2">
              {keywords.slice(0, 20).map((keyword) => (
                <span
                  key={keyword.id}
                  className="rounded-full bg-white/10 border border-white/10 px-3 py-1 text-sm text-white/80"
                >
                  {keyword.name}
                </span>
              ))}
            </div>
          </section>
          </FadeIn>
        )}

        {/* From the same collection */}
        {collectionMovies.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-6">From the same collection</h2>
            {/* Mobile: Horizontal scroll, Desktop: Grid */}
            <div className="block sm:hidden">
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {collectionMovies.map((rec: Movie) => (
                  <Link key={rec.id} href={`/movie/${rec.id}`} className="group w-[140px] shrink-0">
                    <ScaleIn>
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                      {rec.poster_path ? (
                        <Image
                          src={TMDB.img(rec.poster_path, "w500")}
                          alt={rec.title}
                          fill
                          sizes="140px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL={BLUR_DATA_URL}
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-content-center text-white/40 text-sm">
                          No image
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        {(rec.vote_average ?? 0).toFixed(1)}
                      </div>
                    </div>
                    <div className="mt-2">
                      <h3 className="font-medium text-sm line-clamp-2 group-hover:text-white/80 transition-colors">
                        {rec.title}
                      </h3>
                      <p className="text-white/60 text-xs mt-1">
                        {rec.release_date?.split("-")[0] || "N/A"}
                      </p>
                    </div>
                    </ScaleIn>
                  </Link>
                ))}
              </div>
            </div>
            {/* Desktop Grid */}
            <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {collectionMovies.map((rec: Movie) => (
                <Link key={rec.id} href={`/movie/${rec.id}`} className="group">
                  <ScaleIn>
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                    {rec.poster_path ? (
                      <Image
                        src={TMDB.img(rec.poster_path, "w500")}
                        alt={rec.title}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 16vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-content-center text-white/40 text-sm">
                        No image
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium flex items-center gap-1">
                      <span className="text-yellow-400">★</span>
                      {(rec.vote_average ?? 0).toFixed(1)}
                    </div>
                  </div>
                  <div className="mt-2">
                    <h3 className="font-medium text-base line-clamp-2 group-hover:text-white/80 transition-colors">
                      {rec.title}
                    </h3>
                    <p className="text-white/60 text-xs mt-1">
                      {rec.release_date?.split("-")[0] || "N/A"}
                    </p>
                  </div>
                  </ScaleIn>
                </Link>
              ))}
            </div>
          </section>
        )}

        {recs.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-6">Recommended Movies</h2>
            {/* Mobile: Horizontal scroll, Desktop: Grid */}
            <div className="block sm:hidden">
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {recs.map((rec) => (
                  <Link key={rec.id} href={`/movie/${rec.id}`} className="group w-[140px] shrink-0">
                    <ScaleIn>
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                      {rec.poster_path ? (
                        <Image
                          src={TMDB.img(rec.poster_path, "w500")}
                          alt={rec.title}
                          fill
                          sizes="140px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                          placeholder="blur"
                          blurDataURL={BLUR_DATA_URL}
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-content-center text-white/40 text-sm">
                          No image
                        </div>
                        )}
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        {(rec.vote_average ?? 0).toFixed(1)}
                      </div>
                    </div>
                    <div className="mt-2">
                      <h3 className="font-medium text-sm line-clamp-2 group-hover:text-white/80 transition-colors">
                        {rec.title}
                      </h3>
                      <p className="text-white/60 text-xs mt-1">
                        {rec.release_date?.split("-")[0] || "N/A"}
                      </p>
                    </div>
                    </ScaleIn>
                  </Link>
                ))}
              </div>
            </div>
            {/* Desktop Grid */}
            <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {recs.map((rec) => (
                <Link key={rec.id} href={`/movie/${rec.id}`} className="group">
                  <ScaleIn>
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                    {rec.poster_path ? (
                      <Image
                        src={TMDB.img(rec.poster_path, "w500")}
                        alt={rec.title}
                        fill
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 16vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-content-center text-white/40 text-sm">
                        No image
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium flex items-center gap-1">
                      <span className="text-yellow-400">★</span>
                      {(rec.vote_average ?? 0).toFixed(1)}
                    </div>
                  </div>
                  <div className="mt-2">
                    <h3 className="font-medium text-base line-clamp-2 group-hover:text-white/80 transition-colors">
                      {rec.title}
                    </h3>
                    <p className="text-white/60 text-xs mt-1">
                      {rec.release_date?.split("-")[0] || "N/A"}
                    </p>
                  </div>
                  </ScaleIn>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </Suspense>
  );
}