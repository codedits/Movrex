import { NextResponse } from "next/server";

const TMDB = {
  base: "https://api.themoviedb.org/3",
  key: process.env.NEXT_PUBLIC_TMDB_API_KEY,
};

export async function GET() {
  try {
    const res = await fetch(`${TMDB.base}/movie/popular?api_key=${TMDB.key}`, {
      next: { revalidate: 60 },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}


