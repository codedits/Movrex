import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import MovieGallery from "@/components/MovieGallery";
import { FadeIn, ScaleIn } from "@/components/Reveal";
import StarRating from "@/components/StarRating";

// ── Types ───────────────────────────────────────────
type TVShow = {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  first_air_date?: string;
  last_air_date?: string;
  status?: string;
  tagline?: string;
  type?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  genres?: { id: number; name: string }[];
  spoken_languages?: { english_name: string; iso_639_1: string; name: string }[];
  production_companies?: { id: number; name: string; logo_path: string | null; origin_country: string }[];
  production_countries?: { iso_3166_1: string; name: string }[];
  networks?: { id: number; name: string; logo_path: string | null; origin_country: string }[];
  created_by?: { id: number; name: string; profile_path: string | null }[];
  seasons?: {
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    season_number: number;
    episode_count: number;
    air_date: string | null;
    vote_average?: number;
  }[];
  popularity?: number;
  homepage?: string | null;
  images?: {
    posters?: { file_path: string; width: number; height: number }[];
    backdrops?: { file_path: string; width: number; height: number }[];
  };
  videos?: { results: { key: string; name: string; site: string; type: string }[] };
  credits?: {
    cast: { id: number; name: string; character?: string; profile_path: string | null }[];
    crew: { id: number; name: string; job: string }[];
  };
  keywords?: { results?: { id: number; name: string }[] };
  recommendations?: { results: TVShow[] };
  similar?: { results: TVShow[] };
  reviews?: {
    results: {
      id: string;
      author: string;
      content: string;
      created_at: string;
      author_details?: { rating?: number | null; avatar_path?: string | null };
    }[];
  };
  content_ratings?: {
    results: { iso_3166_1: string; rating: string }[];
  };
  external_ids?: {
    imdb_id?: string | null;
    facebook_id?: string | null;
    instagram_id?: string | null;
    twitter_id?: string | null;
    tvdb_id?: number | null;
  };
};

type Provider = { provider_id: number; provider_name: string; logo_path: string | null };
type RegionProviders = { link?: string; flatrate?: Provider[]; rent?: Provider[]; buy?: Provider[] };

// ── TMDB helpers (server-side) ──────────────────────
const TMDB_SERVER_BASE = "https://api.themoviedb.org/3";

function buildTmdbUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(`${TMDB_SERVER_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  if (!process.env.TMDB_ACCESS_TOKEN && process.env.TMDB_API_KEY) {
    url.searchParams.set("api_key", process.env.TMDB_API_KEY);
  }
  return url.toString();
}

function buildTmdbHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (process.env.TMDB_ACCESS_TOKEN) h["Authorization"] = `Bearer ${process.env.TMDB_ACCESS_TOKEN}`;
  return h;
}

const TMDB_IMG = (path: string, size: string = "w780") =>
  `https://image.tmdb.org/t/p/${size}${path}`;

const BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==";

// ── Data fetching ───────────────────────────────────
async function fetchTVShow(id: string): Promise<TVShow> {
  const url = buildTmdbUrl(`/tv/${id}`, {
    append_to_response: "credits,videos,images,keywords,recommendations,similar,reviews,content_ratings,external_ids",
    include_image_language: "en,null",
  });
  const res = await fetch(url, { next: { revalidate: 60 * 60 }, headers: buildTmdbHeaders() });
  if (!res.ok) {
    if (res.status === 404) throw new Error("TV show not found");
    throw new Error(`Failed to fetch TV show: ${res.status}`);
  }
  return res.json();
}

async function fetchTVWatchProviders(tvId: string): Promise<{ region: string; data: RegionProviders } | null> {
  try {
    const url = buildTmdbUrl(`/tv/${tvId}/watch/providers`);
    const res = await fetch(url, { next: { revalidate: 60 * 60 }, headers: buildTmdbHeaders() });
    if (!res.ok) return null;
    const json = await res.json();
    const results = json?.results || {};
    const regionPreference = ["US", "GB", "IN", "CA", "AU", "DE", "FR"];
    const region = regionPreference.find((r) => results[r]) || Object.keys(results)[0];
    if (!region) return null;
    return { region, data: results[region] || {} };
  } catch {
    return null;
  }
}

// ── Skeleton ────────────────────────────────────────
const TVDetailSkeleton = () => (
  <div className="mx-auto max-w-6xl px-4 py-8 animate-pulse">
    <div className="h-6 bg-gray-800 rounded w-20 mb-6" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="aspect-[2/3] bg-gray-800 rounded-xl" />
      <div className="md:col-span-2 space-y-4">
        <div className="h-8 bg-gray-800 rounded w-3/4" />
        <div className="h-4 bg-gray-800 rounded w-1/2" />
        <div className="h-4 bg-gray-800 rounded w-full" />
      </div>
    </div>
  </div>
);

// ── Page ────────────────────────────────────────────
export default async function TVDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = (await (searchParams || Promise.resolve({}))) as Record<string, string | string[] | undefined>;
  const q = typeof sp.q === "string" ? sp.q : undefined;

  let show: TVShow;
  try {
    show = await fetchTVShow(id);
  } catch (err) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link href={q ? `/?q=${encodeURIComponent(q)}` : "/"} className="text-white/70 hover:text-white transition-colors">← Back</Link>
        <div className="mt-6 text-center">
          <p className="text-white/70 text-lg">Failed to load TV show.</p>
          <p className="text-white/50 text-sm mt-2">{err instanceof Error ? err.message : "Please try again later."}</p>
        </div>
      </div>
    );
  }

  // Extract data
  const cast = (show.credits?.cast || []).slice(0, 12);
  const ytTrailer = show.videos?.results.find((v) => v.site === "YouTube" && v.type === "Trailer");
  const allVideos = show.videos?.results || [];
  const featurettes = allVideos.filter((v) => v.site === "YouTube" && v.type !== "Trailer").slice(0, 6);
  const keywords = (show.keywords?.results || []) as { id: number; name: string }[];
  const recs = show.recommendations?.results?.slice(0, 12) || [];
  const similar = show.similar?.results?.slice(0, 12) || [];
  const reviews = show.reviews?.results?.slice(0, 5) || [];
  const posters = show.images?.posters?.slice(0, 12) || [];
  const backdrops = show.images?.backdrops?.slice(0, 12) || [];
  const ext = show.external_ids || {};
  const seasons = (show.seasons || []).filter((s) => s.season_number > 0); // Exclude "Specials" (season 0)
  const specials = (show.seasons || []).find((s) => s.season_number === 0);

  // Content rating (prefer US)
  const contentRatings = show.content_ratings?.results || [];
  const usRating = contentRatings.find((r) => r.iso_3166_1 === "US");
  const contentRating = usRating?.rating || contentRatings[0]?.rating || null;

  // Creators
  const creators = show.created_by || [];

  // Runtime
  const runtime = show.episode_run_time && show.episode_run_time.length > 0 ? show.episode_run_time[0] : null;

  // Watch providers
  const watch = await fetchTVWatchProviders(id);

  const watchNowUrl = `https://moviebox.ph/web/searchResult?keyword=${encodeURIComponent((show.name || "").replace(/\s+/g, "+"))}`;

  return (
    <Suspense fallback={<TVDetailSkeleton />}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link href={q ? `/?q=${encodeURIComponent(q)}` : "/"} className="text-white/70 hover:text-white transition-colors">← Back</Link>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Poster */}
          {show.poster_path && (
            <ScaleIn>
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10">
                <Image
                  src={TMDB_IMG(show.poster_path, "w780")}
                  alt={show.name}
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
              <h1 className="text-3xl font-semibold tracking-tight">{show.name}</h1>
              {show.tagline && (
                <p className="mt-1 text-white/50 italic text-sm">&ldquo;{show.tagline}&rdquo;</p>
              )}
              <div className="mt-2 text-white/70 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
                <span><span className="text-yellow-400">★</span> {show.vote_average?.toFixed(1)}</span>
                {show.first_air_date && <span>· {show.first_air_date.slice(0, 4)}</span>}
                {show.last_air_date && show.status === "Ended" && (
                  <span>– {show.last_air_date.slice(0, 4)}</span>
                )}
                {show.number_of_seasons && <span>· {show.number_of_seasons} Season{show.number_of_seasons > 1 ? "s" : ""}</span>}
                {show.number_of_episodes && <span>· {show.number_of_episodes} Episodes</span>}
                {runtime && <span>· ~{runtime} min/ep</span>}
                {contentRating && (
                  <span className="ml-1 rounded border border-white/30 px-1.5 py-0.5 text-[10px] font-bold text-white/90 tracking-wide">
                    {contentRating}
                  </span>
                )}
              </div>
              {show.status && (
                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    show.status === "Returning Series" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                    show.status === "Ended" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                    show.status === "Canceled" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                    "bg-white/10 text-white/70 border border-white/20"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      show.status === "Returning Series" ? "bg-green-400" :
                      show.status === "Ended" ? "bg-red-400" :
                      "bg-white/50"
                    }`} />
                    {show.status}
                  </span>
                </div>
              )}
            </FadeIn>

            {show.genres && show.genres.length > 0 && (
              <FadeIn delay={0.05}>
                <div className="mt-3 flex flex-wrap gap-2">
                  {show.genres.map((g) => (
                    <span key={g.id} className="rounded-full bg-white/10 border border-white/10 px-2 py-1 text-xs text-white/80">
                      {g.name}
                    </span>
                  ))}
                </div>
              </FadeIn>
            )}

            <FadeIn delay={0.1}>
              <p className="mt-4 text-white/80 leading-relaxed max-w-prose">{show.overview}</p>
            </FadeIn>

            {/* Rate this show */}
            <FadeIn delay={0.11}>
              <div className="mt-4">
                <StarRating mediaId={show.id} mediaType="tv" />
              </div>
            </FadeIn>

            <FadeIn delay={0.12}>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-white/80">
                <div>
                  <h3 className="font-semibold text-white mb-2">Details</h3>
                  <div className="space-y-1">
                    {show.first_air_date && (
                      <p><span className="text-white/60">First Aired:</span> {new Date(show.first_air_date).toLocaleDateString()}</p>
                    )}
                    {show.spoken_languages && show.spoken_languages.length > 0 && (
                      <p><span className="text-white/60">Languages:</span> {show.spoken_languages.map((l) => l.english_name).join(", ")}</p>
                    )}
                    {creators.length > 0 && (
                      <p><span className="text-white/60">Created by:</span> {creators.map((c) => c.name).join(", ")}</p>
                    )}
                    {show.type && (
                      <p><span className="text-white/60">Type:</span> {show.type}</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Production</h3>
                  <div className="space-y-1">
                    {show.networks && show.networks.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white/60">Networks:</span>
                        {show.networks.map((n) => (
                          <span key={n.id} className="inline-flex items-center gap-1">
                            {n.logo_path && (
                              <Image src={TMDB_IMG(n.logo_path, "w185")} alt={n.name} width={40} height={16} className="h-4 w-auto object-contain invert opacity-70" />
                            )}
                            <span className="text-white/70 text-xs">{n.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {show.production_companies && show.production_companies.length > 0 && (
                      <p><span className="text-white/60">Companies:</span> {show.production_companies.map((c) => c.name).join(", ")}</p>
                    )}
                    {show.production_countries && show.production_countries.length > 0 && (
                      <p><span className="text-white/60">Countries:</span> {show.production_countries.map((c) => c.name).join(", ")}</p>
                    )}
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* External links */}
            {(ext.imdb_id || ext.facebook_id || ext.instagram_id || ext.twitter_id || show.homepage) && (
              <FadeIn delay={0.14}>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {ext.imdb_id && (
                    <a href={`https://www.imdb.com/title/${ext.imdb_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/20 transition">
                      IMDb
                    </a>
                  )}
                  {ext.instagram_id && (
                    <a href={`https://instagram.com/${ext.instagram_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-pink-500/10 border border-pink-500/20 px-3 py-1.5 text-xs font-semibold text-pink-400 hover:bg-pink-500/20 transition">
                      Instagram
                    </a>
                  )}
                  {ext.twitter_id && (
                    <a href={`https://twitter.com/${ext.twitter_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition">
                      X
                    </a>
                  )}
                  {show.homepage && (
                    <a href={show.homepage} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/20 transition">
                      Official Site
                    </a>
                  )}
                </div>
              </FadeIn>
            )}

            {/* Watch providers */}
            {watch?.data && (watch.data.flatrate || watch.data.rent || watch.data.buy) && (
              <FadeIn>
                <section className="mt-6">
                  <h3 className="font-semibold text-white mb-3">Where to watch{watch.region ? ` · ${watch.region}` : ""}</h3>
                  <div className="flex flex-wrap gap-2">
                    {(["Stream", "Rent", "Buy"] as const).map((label) => {
                      const key = label === "Stream" ? "flatrate" : label.toLowerCase();
                      const list = (watch.data?.[key as keyof RegionProviders] as Provider[] | undefined) || [];
                      if (list.length === 0) return null;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-white/60">{label}:</span>
                          <div className="flex items-center gap-2">
                            {list.slice(0, 6).map((p) => (
                              <a
                                key={`${key}-${p.provider_id}`}
                                href={watch.data.link || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-1 hover:bg-white/10 transition text-xs"
                                title={`${label} on ${p.provider_name}`}
                              >
                                {p.logo_path ? (
                                  <Image src={TMDB_IMG(p.logo_path, "w185")} alt={p.provider_name} width={18} height={18} className="rounded" />
                                ) : (
                                  <span className="w-[18px] h-[18px] grid place-content-center">📺</span>
                                )}
                                <span className="hidden sm:inline text-white/80">{p.provider_name}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </FadeIn>
            )}

            {/* Trailer + Videos */}
            {(ytTrailer || featurettes.length > 0) && (
              <FadeIn>
                <div className="mt-6">
                  <h3 className="font-semibold text-white mb-3">Videos</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    {ytTrailer && (
                      <a
                        href={`https://www.youtube.com/watch?v=${ytTrailer.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                        Watch Trailer
                      </a>
                    )}
                    <a href={watchNowUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors">
                      Watch Now
                    </a>
                  </div>
                  {featurettes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {featurettes.map((v) => (
                        <a
                          key={v.key}
                          href={`https://www.youtube.com/watch?v=${v.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition"
                        >
                          <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                          {v.name.length > 40 ? v.name.slice(0, 37) + "..." : v.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </FadeIn>
            )}
          </div>
        </div>

        {/* ── Cast ───────────────────────────────────── */}
        {cast.length > 0 && (
          <FadeIn>
            <section className="mt-12">
              <h2 className="text-2xl font-semibold mb-6">Cast</h2>
              <div className="block sm:hidden">
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {cast.map((person) => (
                    <Link key={person.id} href={`/person/${person.id}`} className="shrink-0">
                      <ScaleIn>
                        <div className="text-center w-[120px]">
                          <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900 mb-2">
                            {person.profile_path ? (
                              <Image src={TMDB_IMG(person.profile_path, "w342")} alt={person.name} fill sizes="120px" className="object-cover" loading="lazy" placeholder="blur" blurDataURL={BLUR_DATA_URL} />
                            ) : (
                              <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">No image</div>
                            )}
                          </div>
                          <p className="text-sm font-medium line-clamp-2">{person.name}</p>
                          {person.character && <p className="text-xs text-white/60 line-clamp-2">{person.character}</p>}
                        </div>
                      </ScaleIn>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {cast.map((person) => (
                  <Link key={person.id} href={`/person/${person.id}`} className="group">
                    <ScaleIn>
                      <div className="text-center">
                        <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900 mb-2 group-hover:border-white/30 transition-colors">
                          {person.profile_path ? (
                            <Image src={TMDB_IMG(person.profile_path, "w342")} alt={person.name} fill sizes="(max-width: 768px) 33vw, 16vw" className="object-cover" loading="lazy" placeholder="blur" blurDataURL={BLUR_DATA_URL} />
                          ) : (
                            <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">No image</div>
                          )}
                        </div>
                        <p className="text-sm font-medium group-hover:text-white/80">{person.name}</p>
                        {person.character && <p className="text-xs text-white/60">{person.character}</p>}
                      </div>
                    </ScaleIn>
                  </Link>
                ))}
              </div>
            </section>
          </FadeIn>
        )}

        {/* ── Seasons ────────────────────────────────── */}
        {seasons.length > 0 && (
          <FadeIn>
            <section className="mt-12">
              <h2 className="text-2xl font-semibold mb-6">Seasons</h2>
              <div className="space-y-4">
                {seasons.map((season) => (
                  <div key={season.id} className="flex gap-4 items-start rounded-xl border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.04] transition">
                    <div className="relative w-[80px] aspect-[2/3] rounded-lg overflow-hidden border border-white/10 bg-gray-900 shrink-0">
                      {season.poster_path ? (
                        <Image src={TMDB_IMG(season.poster_path, "w300")} alt={season.name} fill sizes="80px" className="object-cover" loading="lazy" />
                      ) : (
                        <div className="absolute inset-0 grid place-content-center text-white/40 text-[10px]">No poster</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm">{season.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-white/50">
                        {season.air_date && <span>{new Date(season.air_date).getFullYear()}</span>}
                        <span>· {season.episode_count} episode{season.episode_count !== 1 ? "s" : ""}</span>
                        {season.vote_average ? (
                          <span>· <span className="text-yellow-400">★</span> {season.vote_average.toFixed(1)}</span>
                        ) : null}
                      </div>
                      {season.overview && (
                        <p className="mt-1.5 text-xs text-white/60 line-clamp-2">{season.overview}</p>
                      )}
                    </div>
                  </div>
                ))}
                {specials && specials.episode_count > 0 && (
                  <div className="flex gap-4 items-start rounded-xl border border-white/10 bg-white/[0.02] p-3 opacity-70">
                    <div className="relative w-[80px] aspect-[2/3] rounded-lg overflow-hidden border border-white/10 bg-gray-900 shrink-0">
                      {specials.poster_path ? (
                        <Image src={TMDB_IMG(specials.poster_path, "w300")} alt="Specials" fill sizes="80px" className="object-cover" loading="lazy" />
                      ) : (
                        <div className="absolute inset-0 grid place-content-center text-white/40 text-[10px]">Specials</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm">Specials</h3>
                      <p className="text-xs text-white/50 mt-1">{specials.episode_count} episode{specials.episode_count !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </FadeIn>
        )}

        {/* ── Gallery ────────────────────────────────── */}
        {(posters.length > 0 || backdrops.length > 0) && (
          <FadeIn>
            <section className="mt-12">
              <MovieGallery
                images={[
                  ...backdrops.map((b) => ({ src: TMDB_IMG(b.file_path, "w780"), alt: "Backdrop" })),
                  ...posters.map((p) => ({ src: TMDB_IMG(p.file_path, "w780"), alt: "Poster" })),
                ]}
                title="Gallery"
              />
            </section>
          </FadeIn>
        )}

        {/* ── Keywords ───────────────────────────────── */}
        {keywords.length > 0 && (
          <FadeIn>
            <section className="mt-12">
              <h2 className="text-2xl font-semibold mb-6">Keywords</h2>
              <div className="flex flex-wrap gap-2">
                {keywords.slice(0, 20).map((kw) => (
                  <span key={kw.id} className="rounded-full bg-white/10 border border-white/10 px-3 py-1 text-sm text-white/80">{kw.name}</span>
                ))}
              </div>
            </section>
          </FadeIn>
        )}

        {/* ── Reviews ────────────────────────────────── */}
        {reviews.length > 0 && (
          <FadeIn>
            <section className="mt-12">
              <h2 className="text-2xl font-semibold mb-6">Reviews</h2>
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-white/10 grid place-content-center text-sm font-semibold text-white/70">
                        {review.author.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{review.author}</p>
                        <div className="flex items-center gap-2 text-xs text-white/50">
                          {review.author_details?.rating && (
                            <span><span className="text-yellow-400">★</span> {review.author_details.rating}/10</span>
                          )}
                          <span>{new Date(review.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed line-clamp-4">{review.content}</p>
                  </div>
                ))}
              </div>
            </section>
          </FadeIn>
        )}

        {/* ── Similar Shows ──────────────────────────── */}
        {similar.length > 0 && (
          <FadeIn>
            <section className="mt-12">
              <h2 className="text-2xl font-semibold mb-6">Similar Shows</h2>
              <div className="block sm:hidden">
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {similar.map((s) => (
                    <Link key={s.id} href={`/tv/${s.id}`} className="group w-[140px] shrink-0">
                      <ScaleIn>
                        <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                          {s.poster_path ? (
                            <Image src={TMDB_IMG(s.poster_path, "w300")} alt={s.name} fill sizes="140px" className="object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" placeholder="blur" blurDataURL={BLUR_DATA_URL} />
                          ) : (
                            <div className="absolute inset-0 grid place-content-center text-white/40 text-sm">No image</div>
                          )}
                          <div className="absolute top-2 right-2 bg-black/70 rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1">
                            <span className="text-yellow-400">★</span>{(s.vote_average ?? 0).toFixed(1)}
                          </div>
                        </div>
                        <div className="mt-2">
                          <h3 className="font-medium text-sm line-clamp-2">{s.name}</h3>
                          <p className="text-white/60 text-xs mt-1">{s.first_air_date?.split("-")[0] || "N/A"}</p>
                        </div>
                      </ScaleIn>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {similar.map((s) => (
                  <Link key={s.id} href={`/tv/${s.id}`} className="group">
                    <ScaleIn>
                      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                        {s.poster_path ? (
                          <Image src={TMDB_IMG(s.poster_path, "w300")} alt={s.name} fill sizes="16vw" className="object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" placeholder="blur" blurDataURL={BLUR_DATA_URL} />
                        ) : (
                          <div className="absolute inset-0 grid place-content-center text-white/40 text-sm">No image</div>
                        )}
                        <div className="absolute top-2 right-2 bg-black/70 rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1">
                          <span className="text-yellow-400">★</span>{(s.vote_average ?? 0).toFixed(1)}
                        </div>
                      </div>
                      <div className="mt-2">
                        <h3 className="font-medium text-base line-clamp-2">{s.name}</h3>
                        <p className="text-white/60 text-xs mt-1">{s.first_air_date?.split("-")[0] || "N/A"}</p>
                      </div>
                    </ScaleIn>
                  </Link>
                ))}
              </div>
            </section>
          </FadeIn>
        )}

        {/* ── Recommended ────────────────────────────── */}
        {recs.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-6">Recommended</h2>
            <div className="block sm:hidden">
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {recs.map((r) => (
                  <Link key={r.id} href={`/tv/${r.id}`} className="group w-[140px] shrink-0">
                    <ScaleIn>
                      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                        {r.poster_path ? (
                          <Image src={TMDB_IMG(r.poster_path, "w300")} alt={r.name} fill sizes="140px" className="object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" placeholder="blur" blurDataURL={BLUR_DATA_URL} />
                        ) : (
                          <div className="absolute inset-0 grid place-content-center text-white/40 text-sm">No image</div>
                        )}
                        <div className="absolute top-2 right-2 bg-black/70 rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1">
                          <span className="text-yellow-400">★</span>{(r.vote_average ?? 0).toFixed(1)}
                        </div>
                      </div>
                      <div className="mt-2">
                        <h3 className="font-medium text-sm line-clamp-2">{r.name}</h3>
                        <p className="text-white/60 text-xs mt-1">{r.first_air_date?.split("-")[0] || "N/A"}</p>
                      </div>
                    </ScaleIn>
                  </Link>
                ))}
              </div>
            </div>
            <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {recs.map((r) => (
                <Link key={r.id} href={`/tv/${r.id}`} className="group">
                  <ScaleIn>
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                      {r.poster_path ? (
                        <Image src={TMDB_IMG(r.poster_path, "w300")} alt={r.name} fill sizes="16vw" className="object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" placeholder="blur" blurDataURL={BLUR_DATA_URL} />
                      ) : (
                        <div className="absolute inset-0 grid place-content-center text-white/40 text-sm">No image</div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/70 rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1">
                        <span className="text-yellow-400">★</span>{(r.vote_average ?? 0).toFixed(1)}
                      </div>
                    </div>
                    <div className="mt-2">
                      <h3 className="font-medium text-base line-clamp-2">{r.name}</h3>
                      <p className="text-white/60 text-xs mt-1">{r.first_air_date?.split("-")[0] || "N/A"}</p>
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
