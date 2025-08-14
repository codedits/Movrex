import { NextResponse } from "next/server";

const TMDB = {
  base: "https://api.themoviedb.org/3",
  key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
};

// Supports TMDB discover parameters via query string, e.g.:
// with_genres=28,12
// with_people=12345
// year=2020 (maps to primary_release_year)
// release_date_gte=2020-01-01 (maps to release_date.gte)
// release_date_lte=2020-12-31 (maps to release_date.lte)
// vote_average_gte=7
// vote_average_lte=9
// sort_by=popularity.desc|vote_average.desc|release_date.desc
// page=1
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sp = url.searchParams;

    const withGenres = sp.get("with_genres");
    const withPeople = sp.get("with_people");
    const year = sp.get("year");
    const releaseDateGte = sp.get("release_date_gte");
    const releaseDateLte = sp.get("release_date_lte");
    const voteAverageGte = sp.get("vote_average_gte");
    const voteAverageLte = sp.get("vote_average_lte");
    const sortBy = sp.get("sort_by");
    const page = sp.get("page") || "1";

    const hasAnyFilter = Boolean(
      withGenres ||
      withPeople ||
      year ||
      releaseDateGte ||
      releaseDateLte ||
      voteAverageGte ||
      voteAverageLte ||
      sortBy
    );

    // If no filters are provided, fall back to popular movies to keep behavior predictable
    const baseEndpoint = hasAnyFilter
      ? `${TMDB.base}/discover/movie`
      : `${TMDB.base}/movie/popular`;

    const out = new URL(baseEndpoint);
    if (TMDB.key) out.searchParams.set("api_key", TMDB.key);
    out.searchParams.set("page", page);

    if (withGenres) out.searchParams.set("with_genres", withGenres);
    if (withPeople) out.searchParams.set("with_people", withPeople);
    if (year) out.searchParams.set("primary_release_year", year);
    if (releaseDateGte) out.searchParams.set("release_date.gte", releaseDateGte);
    if (releaseDateLte) out.searchParams.set("release_date.lte", releaseDateLte);
    if (voteAverageGte) out.searchParams.set("vote_average.gte", voteAverageGte);
    if (voteAverageLte) out.searchParams.set("vote_average.lte", voteAverageLte);
    if (sortBy) out.searchParams.set("sort_by", sortBy);

    const res = await fetch(out.toString(), { next: { revalidate: 60 } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ results: [], error: "discover_failed" }, { status: 500 });
  }
}


