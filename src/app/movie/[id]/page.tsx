import Image from "next/image";
import Link from "next/link";
import MovieGallery from "@/components/MovieGallery";

type Movie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  runtime?: number;
  genres?: { id: number; name: string }[];
  spoken_languages?: { english_name: string; iso_639_1: string; name: string }[];
  production_companies?: { id: number; name: string; logo_path: string | null; origin_country: string }[];
  production_countries?: { iso_3166_1: string; name: string }[];
  popularity?: number;
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

export default async function MovieDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = `${TMDB.base}/movie/${id}?api_key=${TMDB.key}&append_to_response=credits,videos,images,keywords,recommendations&include_image_language=en,null`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 } });
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/" className="text-white/70 hover:text-white">← Back</Link>
        <p className="mt-6 text-white/70">Failed to load movie.</p>
      </div>
    );
  }
  const movie: Movie = await res.json();

  const directors = movie.credits?.crew.filter((c) => c.job === "Director") || [];
  const ytTrailer = movie.videos?.results.find((v) => v.site === "YouTube" && v.type === "Trailer");
  const keywords = (movie.keywords?.keywords || movie.keywords?.results || []) as { id: number; name: string }[];
  const cast = (movie.credits?.cast || []).slice(0, 12);
  const recs = movie.recommendations?.results?.slice(0, 12) || [];
  const posters = movie.images?.posters?.slice(0, 12) || [];
  const backdrops = movie.images?.backdrops?.slice(0, 12) || [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-white/70 hover:text-white">← Back</Link>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {movie.poster_path && (
          <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10">
            <Image
              src={TMDB.img(movie.poster_path, "w780")}
              alt={movie.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover"
            />
          </div>
        )}

        <div className="md:col-span-2">
          <h1 className="text-2xl font-semibold tracking-tight">{movie.title}</h1>
          <div className="mt-2 text-white/70 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
            <span><span className="text-yellow-400">★</span> {movie.vote_average?.toFixed(1)}</span>
            {movie.release_date && <span>· {movie.release_date?.slice(0, 4)}</span>}
            {movie.runtime && <span>· {movie.runtime} min</span>}
            {movie.popularity && <span>· Popularity {Math.round(movie.popularity)}</span>}
          </div>

          {movie.genres && movie.genres.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {movie.genres.map((g) => (
                <span key={g.id} className="rounded-full bg-white/10 border border-white/10 px-2 py-1 text-xs text-white/80">
                  {g.name}
                </span>
              ))}
            </div>
          )}

          <p className="mt-4 text-white/80 leading-relaxed max-w-prose">{movie.overview}</p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-white/80">
            <div>
              <h3 className="text-white/60 text-xs uppercase tracking-wide">Languages</h3>
              <div className="mt-1 flex flex-wrap gap-2">
                {(movie.spoken_languages || []).map((l) => (
                  <span key={l.iso_639_1} className="rounded bg-white/10 px-2 py-1">{l.english_name || l.name}</span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-white/60 text-xs uppercase tracking-wide">Production Countries</h3>
              <div className="mt-1 flex flex-wrap gap-2">
                {(movie.production_countries || []).map((c) => (
                  <span key={c.iso_3166_1} className="rounded bg-white/10 px-2 py-1">{c.name}</span>
                ))}
              </div>
            </div>
          </div>

          {movie.production_companies && movie.production_companies.length > 0 && (
            <div className="mt-4">
              <h3 className="text-white/60 text-xs uppercase tracking-wide">Production Companies</h3>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {movie.production_companies.map((pc) => (
                  <div key={pc.id} className="flex items-center gap-2">
                    {pc.logo_path ? (
                      <Image src={TMDB.img(pc.logo_path, "w185")} alt={pc.name} width={40} height={20} className="object-contain mix-blend-screen" />
                    ) : null}
                    <span className="text-white/80 text-sm">{pc.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {directors.length > 0 && (
            <div className="mt-4">
              <h3 className="text-white/60 text-xs uppercase tracking-wide">Director(s)</h3>
              <div className="mt-1 flex flex-wrap gap-2">
                {directors.map((d) => (
                  <span key={d.id} className="rounded bg-white/10 px-2 py-1">{d.name}</span>
                ))}
              </div>
            </div>
          )}

          {ytTrailer && (
            <div className="mt-6">
              <h3 className="text-white/60 text-xs uppercase tracking-wide">Trailer</h3>
              <a
                href={`https://www.youtube.com/watch?v=${ytTrailer.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-2 rounded-full bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90"
              >
                Watch on YouTube
              </a>
            </div>
          )}
        </div>
      </div>

      {cast.length > 0 && (
        <section className="mt-10">
          <h2 className="text-white/80 text-sm mb-3">Cast</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {cast.map((person) => (
              <div key={person.id} className="text-center">
                {person.profile_path ? (
                  <Image
                    src={TMDB.img(person.profile_path, "w185")}
                    alt={person.name}
                    width={185}
                    height={278}
                    className="h-44 w-full object-cover rounded-lg border border-white/10"
                  />
                ) : (
                  <div className="h-44 w-full rounded-lg grid place-content-center border border-white/10 text-white/40 text-xs">No photo</div>
                )}
                <div className="mt-2 text-xs text-white/90 truncate">{person.name}</div>
                {person.character && (
                  <div className="text-[11px] text-white/60 truncate">as {person.character}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {(posters.length > 0 || backdrops.length > 0) && (
        <MovieGallery
          title="Gallery"
          images={[
            ...backdrops.map((b) => ({ src: TMDB.img(b.file_path, "w780"), alt: "Backdrop" })),
            ...posters.map((p) => ({ src: TMDB.img(p.file_path, "w780"), alt: "Poster" })),
          ]}
        />
      )}

      {keywords.length > 0 && (
        <section className="mt-10">
          <h2 className="text-white/80 text-sm mb-3">Keywords</h2>
          <div className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <span key={k.id} className="rounded-full bg-white/10 border border-white/10 px-2 py-1 text-xs text-white/80">
                {k.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {recs.length > 0 && (
        <section className="mt-10">
          <h2 className="text-white/80 text-sm mb-3">Recommended</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recs.map((m) => (
              <Link key={m.id} href={`/movie/${m.id}`} className="group">
                <div className="relative overflow-hidden rounded-xl bg-[--color-card] border border-white/5">
                  {m.poster_path ? (
                    <Image src={TMDB.img(m.poster_path, "w342")} alt={m.title} width={342} height={513} className="h-64 w-full object-cover group-hover:opacity-90 transition" />
                  ) : (
                    <div className="h-64 w-full grid place-content-center text-white/40 text-sm">No image</div>
                  )}
                </div>
                <div className="mt-2 text-xs text-white/90 truncate">{m.title}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


