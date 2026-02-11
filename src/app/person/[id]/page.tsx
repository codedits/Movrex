import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import MovieGallery from "@/components/MovieGallery";
import { FadeIn, ScaleIn } from "@/components/Reveal";

// ── Types ───────────────────────────────────────────
type CreditItem = {
  id: number;
  title?: string;
  name?: string;
  media_type: "movie" | "tv";
  character?: string;
  job?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
  episode_count?: number;
};

type PersonDetail = {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  also_known_as: string[];
  gender: number;
  popularity: number;
  homepage: string | null;
  combined_credits?: { cast: CreditItem[]; crew: CreditItem[] };
  images?: { profiles: { file_path: string; width: number; height: number }[] };
  external_ids?: {
    imdb_id?: string | null;
    facebook_id?: string | null;
    instagram_id?: string | null;
    twitter_id?: string | null;
    tiktok_id?: string | null;
    wikidata_id?: string | null;
  };
};

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
async function fetchPerson(id: string): Promise<PersonDetail> {
  const url = buildTmdbUrl(`/person/${id}`, {
    append_to_response: "combined_credits,images,external_ids",
  });
  const res = await fetch(url, {
    next: { revalidate: 60 * 60 },
    headers: buildTmdbHeaders(),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Person not found");
    throw new Error(`Failed to fetch person: ${res.status}`);
  }
  return res.json();
}

// ── Helpers ─────────────────────────────────────────
function deduplicateCredits(credits: CreditItem[]): CreditItem[] {
  const map = new Map<string, CreditItem>();
  for (const c of credits) {
    const key = `${c.media_type}-${c.id}`;
    const existing = map.get(key);
    if (!existing || (c.popularity || 0) > (existing.popularity || 0)) {
      map.set(key, c);
    }
  }
  return Array.from(map.values());
}

function calculateAge(birthday: string, deathday?: string | null): number {
  const end = deathday ? new Date(deathday) : new Date();
  const born = new Date(birthday);
  let age = end.getFullYear() - born.getFullYear();
  const m = end.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < born.getDate())) age--;
  return age;
}

// ── Skeleton ────────────────────────────────────────
const PersonSkeleton = () => (
  <div className="mx-auto max-w-6xl px-4 py-8 animate-pulse">
    <div className="h-6 bg-gray-800 rounded w-20 mb-6" />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      <div className="aspect-[2/3] bg-gray-800 rounded-xl" />
      <div className="md:col-span-3 space-y-4">
        <div className="h-8 bg-gray-800 rounded w-1/2" />
        <div className="h-4 bg-gray-800 rounded w-1/3" />
        <div className="h-4 bg-gray-800 rounded w-full" />
        <div className="h-4 bg-gray-800 rounded w-3/4" />
      </div>
    </div>
  </div>
);

// ── Page ────────────────────────────────────────────
export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let person: PersonDetail;
  try {
    person = await fetchPerson(id);
  } catch (err) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/" className="text-white/70 hover:text-white transition-colors">← Back</Link>
        <div className="mt-6 text-center">
          <p className="text-white/70 text-lg">Failed to load person.</p>
          <p className="text-white/50 text-sm mt-2">
            {err instanceof Error ? err.message : "Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  const ext = person.external_ids || {};
  const allCast = deduplicateCredits(person.combined_credits?.cast || []);
  const allCrew = deduplicateCredits(person.combined_credits?.crew || []);

  // Known for: top 12 by popularity (acting)
  const knownFor = [...allCast]
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 12);

  // Split filmography
  const movieCredits = allCast
    .filter((c) => c.media_type === "movie")
    .sort((a, b) => {
      const da = a.release_date || "";
      const db = b.release_date || "";
      return db.localeCompare(da);
    });
  const tvCredits = allCast
    .filter((c) => c.media_type === "tv")
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  // Crew highlights (directing, producing, writing)
  const crewHighlights = allCrew
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 12);

  const photos = person.images?.profiles || [];

  return (
    <Suspense fallback={<PersonSkeleton />}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/" className="text-white/70 hover:text-white transition-colors">
          ← Back
        </Link>

        {/* ── Header: Photo + Info ───────────────────── */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          {/* Profile photo */}
          <ScaleIn>
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-gray-900 max-w-[280px] mx-auto md:mx-0">
              {person.profile_path ? (
                <Image
                  src={TMDB_IMG(person.profile_path, "w780")}
                  alt={person.name}
                  fill
                  sizes="(max-width: 768px) 60vw, 25vw"
                  className="object-cover"
                  priority
                  placeholder="blur"
                  blurDataURL={BLUR_DATA_URL}
                />
              ) : (
                <div className="absolute inset-0 grid place-content-center text-white/40 text-sm">
                  No photo
                </div>
              )}
            </div>
          </ScaleIn>

          {/* Bio info */}
          <div className="md:col-span-3">
            <FadeIn>
              <h1 className="text-3xl font-semibold tracking-tight">{person.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60">
                {person.known_for_department && (
                  <span className="rounded-full bg-white/10 border border-white/10 px-2.5 py-0.5 text-xs text-white/80">
                    {person.known_for_department}
                  </span>
                )}
                {person.birthday && (
                  <span>
                    Born {new Date(person.birthday).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    {" "}({calculateAge(person.birthday, person.deathday)} years{person.deathday ? " old at death" : " old"})
                  </span>
                )}
                {person.deathday && (
                  <span>
                    · Died {new Date(person.deathday).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                )}
              </div>
              {person.place_of_birth && (
                <p className="mt-1 text-sm text-white/50">{person.place_of_birth}</p>
              )}
            </FadeIn>

            {/* External links */}
            <FadeIn delay={0.05}>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {ext.imdb_id && (
                  <a
                    href={`https://www.imdb.com/name/${ext.imdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/20 transition"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M14.31 9.588v.005c-.077-.048-.227-.07-.42-.07v4.815c.27 0 .44-.06.51-.166.07-.105.106-.39.106-.858V10.56c0-.418-.022-.68-.067-.788-.044-.107-.129-.18-.129-.184zm-.003-.003v.003-.003zM22.41 0H1.59C.72 0 .002.72.002 1.59V22.41c0 .87.718 1.59 1.588 1.59H22.41c.87 0 1.59-.72 1.59-1.59V1.59C24 .72 23.28 0 22.41 0zM4.26 17.383H2.19V6.617H4.26v10.766zm5.932 0H8.4l-.015-5.87c0-.073-.004-.21-.012-.41a20.46 20.46 0 00-.02-.433l-.84 6.713H5.962l-.886-6.482a24.9 24.9 0 01-.026.39c-.006.13-.01.258-.01.39v5.685H3.434V6.617h2.73l.673 5.424.602-5.424h2.754v10.766zm4.158-1.395c0 .485-.04.836-.12 1.05-.08.216-.236.4-.467.553a1.59 1.59 0 01-.518.225 3.05 3.05 0 01-.67.062H10.93V6.617h1.56c.615 0 1.06.03 1.335.09.275.06.494.18.657.36.163.18.27.39.322.63.05.24.076.63.076 1.166v5.73c0 .456-.028.78-.083 1-.056.22-.17.42-.288.557l.001-.002-.001.002c.004-.003.003-.003-.001.003zm4.924-1.77c0 .715-.017 1.17-.052 1.364-.035.194-.12.39-.253.586-.132.196-.31.34-.53.43-.22.09-.52.135-.897.135-.33 0-.596-.044-.8-.134-.203-.09-.37-.223-.502-.4a1.34 1.34 0 01-.238-.525c-.043-.2-.064-.595-.064-1.186V12.77c0-.7.026-1.15.077-1.356.05-.207.162-.41.334-.613.17-.2.369-.35.594-.443.224-.093.474-.14.748-.14.38 0 .68.05.898.148.22.098.393.243.52.434.126.19.204.376.237.556.032.18.048.555.048 1.124v1.68h-2.4v1.402c0 .478.018.765.055.86.037.095.126.143.267.143.187 0 .303-.066.347-.2.044-.132.066-.455.066-.97v-.635h1.665v.002h-.001zm-1.7-2.69c0-.423-.012-.692-.037-.808-.025-.116-.114-.174-.268-.174-.14 0-.23.06-.268.18-.038.12-.057.39-.057.812v.602h.63v-.612z"/></svg>
                    IMDb
                  </a>
                )}
                {ext.instagram_id && (
                  <a
                    href={`https://instagram.com/${ext.instagram_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-pink-500/10 border border-pink-500/20 px-3 py-1.5 text-xs font-semibold text-pink-400 hover:bg-pink-500/20 transition"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    Instagram
                  </a>
                )}
                {ext.twitter_id && (
                  <a
                    href={`https://twitter.com/${ext.twitter_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    X
                  </a>
                )}
                {ext.facebook_id && (
                  <a
                    href={`https://facebook.com/${ext.facebook_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/20 transition"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Facebook
                  </a>
                )}
                {ext.tiktok_id && (
                  <a
                    href={`https://tiktok.com/@${ext.tiktok_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/20 transition"
                  >
                    TikTok
                  </a>
                )}
                {person.homepage && (
                  <a
                    href={person.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/20 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
                    Website
                  </a>
                )}
              </div>
            </FadeIn>

            {/* Biography */}
            {person.biography && (
              <FadeIn delay={0.1}>
                <div className="mt-5">
                  <h2 className="text-lg font-semibold text-white mb-2">Biography</h2>
                  <p className="text-white/75 leading-relaxed text-sm whitespace-pre-line max-w-prose">
                    {person.biography}
                  </p>
                </div>
              </FadeIn>
            )}

            {/* Stats */}
            <FadeIn delay={0.12}>
              <div className="mt-5 flex flex-wrap gap-6 text-sm text-white/60">
                {person.also_known_as && person.also_known_as.length > 0 && (
                  <div>
                    <span className="text-white/40">Also known as:</span>{" "}
                    <span className="text-white/70">{person.also_known_as.slice(0, 4).join(", ")}</span>
                  </div>
                )}
                <div>
                  <span className="text-white/40">Popularity:</span>{" "}
                  <span className="text-white/70">{Math.round(person.popularity)}</span>
                </div>
                <div>
                  <span className="text-white/40">Total credits:</span>{" "}
                  <span className="text-white/70">{allCast.length + allCrew.length}</span>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>

        {/* ── Known For ──────────────────────────────── */}
        {knownFor.length > 0 && (
          <FadeIn>
            <section className="mt-12">
              <h2 className="text-2xl font-semibold mb-6">Known For</h2>
              <div className="block sm:hidden">
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {knownFor.map((credit) => (
                    <Link
                      key={`${credit.media_type}-${credit.id}`}
                      href={credit.media_type === "tv" ? `/tv/${credit.id}` : `/movie/${credit.id}`}
                      className="group w-[130px] shrink-0"
                    >
                      <ScaleIn>
                        <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                          {credit.poster_path ? (
                            <Image
                              src={TMDB_IMG(credit.poster_path, "w300")}
                              alt={credit.title || credit.name || "Credit"}
                              fill
                              sizes="130px"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                              placeholder="blur"
                              blurDataURL={BLUR_DATA_URL}
                            />
                          ) : (
                            <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">No image</div>
                          )}
                          <div className="absolute top-1.5 left-1.5">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${credit.media_type === "tv" ? "bg-purple-600/90" : "bg-blue-600/90"}`}>
                              {credit.media_type === "tv" ? "TV" : "Movie"}
                            </span>
                          </div>
                          <div className="absolute top-1.5 right-1.5 bg-black/70 rounded-full px-1.5 py-0.5 text-[10px] font-medium flex items-center gap-0.5">
                            <span className="text-yellow-400">★</span>
                            {(credit.vote_average ?? 0).toFixed(1)}
                          </div>
                        </div>
                        <div className="mt-2">
                          <h3 className="font-medium text-xs line-clamp-2">{credit.title || credit.name}</h3>
                          {credit.character && (
                            <p className="text-white/50 text-[10px] mt-0.5 line-clamp-1">as {credit.character}</p>
                          )}
                        </div>
                      </ScaleIn>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {knownFor.map((credit) => (
                  <Link
                    key={`${credit.media_type}-${credit.id}`}
                    href={credit.media_type === "tv" ? `/tv/${credit.id}` : `/movie/${credit.id}`}
                    className="group"
                  >
                    <ScaleIn>
                      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                        {credit.poster_path ? (
                          <Image
                            src={TMDB_IMG(credit.poster_path, "w300")}
                            alt={credit.title || credit.name || "Credit"}
                            fill
                            sizes="(max-width: 768px) 33vw, 16vw"
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                            placeholder="blur"
                            blurDataURL={BLUR_DATA_URL}
                          />
                        ) : (
                          <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">No image</div>
                        )}
                        <div className="absolute top-2 left-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${credit.media_type === "tv" ? "bg-purple-600/90" : "bg-blue-600/90"}`}>
                            {credit.media_type === "tv" ? "TV" : "Movie"}
                          </span>
                        </div>
                        <div className="absolute top-2 right-2 bg-black/70 rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1">
                          <span className="text-yellow-400">★</span>
                          {(credit.vote_average ?? 0).toFixed(1)}
                        </div>
                      </div>
                      <div className="mt-2">
                        <h3 className="font-medium text-sm line-clamp-2">{credit.title || credit.name}</h3>
                        {credit.character && (
                          <p className="text-white/50 text-xs mt-0.5 line-clamp-1">as {credit.character}</p>
                        )}
                        <p className="text-white/40 text-xs mt-0.5">
                          {credit.release_date?.split("-")[0] || credit.first_air_date?.split("-")[0] || ""}
                        </p>
                      </div>
                    </ScaleIn>
                  </Link>
                ))}
              </div>
            </section>
          </FadeIn>
        )}

        {/* ── Movie Credits ──────────────────────────── */}
        {movieCredits.length > 0 && (
          <FadeIn>
            <section className="mt-12">
              <h2 className="text-2xl font-semibold mb-2">
                Movies <span className="text-white/40 text-base font-normal">({movieCredits.length})</span>
              </h2>
              <div className="block sm:hidden">
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {movieCredits.slice(0, 24).map((credit) => (
                    <Link key={credit.id} href={`/movie/${credit.id}`} className="group w-[120px] shrink-0">
                      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                        {credit.poster_path ? (
                          <Image src={TMDB_IMG(credit.poster_path, "w300")} alt={credit.title || ""} fill sizes="120px" className="object-cover" loading="lazy" placeholder="blur" blurDataURL={BLUR_DATA_URL} />
                        ) : (
                          <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">No image</div>
                        )}
                      </div>
                      <div className="mt-1.5">
                        <h3 className="text-xs font-medium line-clamp-2">{credit.title}</h3>
                        {credit.character && <p className="text-white/50 text-[10px] line-clamp-1">as {credit.character}</p>}
                        <p className="text-white/40 text-[10px]">{credit.release_date?.split("-")[0] || ""}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="hidden sm:grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {movieCredits.slice(0, 24).map((credit) => (
                  <Link key={credit.id} href={`/movie/${credit.id}`} className="group">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                      {credit.poster_path ? (
                        <Image src={TMDB_IMG(credit.poster_path, "w300")} alt={credit.title || ""} fill sizes="12vw" className="object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" placeholder="blur" blurDataURL={BLUR_DATA_URL} />
                      ) : (
                        <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">No image</div>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <h3 className="text-xs font-medium line-clamp-2">{credit.title}</h3>
                      {credit.character && <p className="text-white/50 text-[10px] line-clamp-1">as {credit.character}</p>}
                      <p className="text-white/40 text-[10px]">{credit.release_date?.split("-")[0] || ""}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </FadeIn>
        )}

        {/* ── TV Credits ─────────────────────────────── */}
        {tvCredits.length > 0 && (
          <FadeIn>
            <section className="mt-12">
              <h2 className="text-2xl font-semibold mb-2">
                TV Shows <span className="text-white/40 text-base font-normal">({tvCredits.length})</span>
              </h2>
              <div className="block sm:hidden">
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {tvCredits.slice(0, 24).map((credit) => (
                    <Link key={credit.id} href={`/tv/${credit.id}`} className="group w-[120px] shrink-0">
                      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                        {credit.poster_path ? (
                          <Image src={TMDB_IMG(credit.poster_path, "w300")} alt={credit.name || ""} fill sizes="120px" className="object-cover" loading="lazy" placeholder="blur" blurDataURL={BLUR_DATA_URL} />
                        ) : (
                          <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">No image</div>
                        )}
                      </div>
                      <div className="mt-1.5">
                        <h3 className="text-xs font-medium line-clamp-2">{credit.name}</h3>
                        {credit.character && <p className="text-white/50 text-[10px] line-clamp-1">as {credit.character}</p>}
                        {credit.episode_count && <p className="text-white/40 text-[10px]">{credit.episode_count} ep.</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="hidden sm:grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {tvCredits.slice(0, 24).map((credit) => (
                  <Link key={credit.id} href={`/tv/${credit.id}`} className="group">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                      {credit.poster_path ? (
                        <Image src={TMDB_IMG(credit.poster_path, "w300")} alt={credit.name || ""} fill sizes="12vw" className="object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" placeholder="blur" blurDataURL={BLUR_DATA_URL} />
                      ) : (
                        <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">No image</div>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <h3 className="text-xs font-medium line-clamp-2">{credit.name}</h3>
                      {credit.character && <p className="text-white/50 text-[10px] line-clamp-1">as {credit.character}</p>}
                      {credit.episode_count && <p className="text-white/40 text-[10px]">{credit.episode_count} episodes</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </FadeIn>
        )}

        {/* ── Crew work (Director / Producer / Writer) ── */}
        {crewHighlights.length > 0 && (
          <FadeIn>
            <section className="mt-12">
              <h2 className="text-2xl font-semibold mb-6">Behind the Camera</h2>
              <div className="block sm:hidden">
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {crewHighlights.map((credit) => (
                    <Link
                      key={`crew-${credit.media_type}-${credit.id}-${credit.job}`}
                      href={credit.media_type === "tv" ? `/tv/${credit.id}` : `/movie/${credit.id}`}
                      className="group w-[120px] shrink-0"
                    >
                      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                        {credit.poster_path ? (
                          <Image src={TMDB_IMG(credit.poster_path, "w300")} alt={credit.title || credit.name || ""} fill sizes="120px" className="object-cover" loading="lazy" placeholder="blur" blurDataURL={BLUR_DATA_URL} />
                        ) : (
                          <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">No image</div>
                        )}
                      </div>
                      <div className="mt-1.5">
                        <h3 className="text-xs font-medium line-clamp-2">{credit.title || credit.name}</h3>
                        {credit.job && <p className="text-white/50 text-[10px]">{credit.job}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="hidden sm:grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {crewHighlights.map((credit) => (
                  <Link
                    key={`crew-${credit.media_type}-${credit.id}-${credit.job}`}
                    href={credit.media_type === "tv" ? `/tv/${credit.id}` : `/movie/${credit.id}`}
                    className="group"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-gray-900">
                      {credit.poster_path ? (
                        <Image src={TMDB_IMG(credit.poster_path, "w300")} alt={credit.title || credit.name || ""} fill sizes="12vw" className="object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" placeholder="blur" blurDataURL={BLUR_DATA_URL} />
                      ) : (
                        <div className="absolute inset-0 grid place-content-center text-white/40 text-xs">No image</div>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <h3 className="text-xs font-medium line-clamp-2">{credit.title || credit.name}</h3>
                      {credit.job && <p className="text-white/50 text-[10px]">{credit.job}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </FadeIn>
        )}

        {/* ── Photo Gallery ──────────────────────────── */}
        {photos.length > 1 && (
          <FadeIn>
            <section className="mt-12">
              <MovieGallery
                images={photos.slice(0, 20).map((p) => ({
                  src: TMDB_IMG(p.file_path, "w780"),
                  alt: `${person.name} photo`,
                }))}
                title="Photos"
              />
            </section>
          </FadeIn>
        )}
      </div>
    </Suspense>
  );
}
