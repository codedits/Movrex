import Image from "next/image";
import Link from "next/link";

type Movie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  genres?: { id: number; name: string }[];
  runtime?: number;
  release_date?: string;
};

const TMDB = {
  base: "https://api.themoviedb.org/3",
  key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
  img: (path: string, size: "w500" | "w780" | "original" = "w780") =>
    `https://image.tmdb.org/t/p/${size}${path}`,
};

export default async function MovieDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${TMDB.base}/movie/${id}?api_key=${TMDB.key}`, {
    // Revalidate periodically for fresh data
    next: { revalidate: 60 * 60 },
  });
  const movie: Movie = await res.json();

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
          <div className="mt-2 text-white/70 text-sm">
            <span>★ {movie.vote_average?.toFixed(1)}</span>
            {movie.release_date && <span className="mx-2">·</span>}
            {movie.release_date && <span>{movie.release_date?.slice(0, 4)}</span>}
            {movie.runtime && <span className="mx-2">·</span>}
            {movie.runtime && <span>{movie.runtime} min</span>}
          </div>

          {movie.genres && movie.genres.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {movie.genres.map((g) => (
                <span
                  key={g.id}
                  className="rounded-full bg-white/10 border border-white/10 px-2 py-1 text-xs text-white/80"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          <p className="mt-4 text-white/80 leading-relaxed max-w-prose">{movie.overview}</p>
        </div>
      </div>
    </div>
  );
}


