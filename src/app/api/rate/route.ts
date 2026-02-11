import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (TMDB_ACCESS_TOKEN) h["Authorization"] = `Bearer ${TMDB_ACCESS_TOKEN}`;
  return h;
}

// GET /api/rate?action=session — create a guest session
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  if (action === "session") {
    try {
      const url = new URL(`${TMDB_BASE}/authentication/guest_session/new`);
      if (!TMDB_ACCESS_TOKEN && TMDB_API_KEY) {
        url.searchParams.set("api_key", TMDB_API_KEY);
      }
      const res = await fetch(url.toString(), { headers: getHeaders() });
      const data = await res.json();
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ error: "Failed to create guest session" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// POST /api/rate — submit a rating { media_type, media_id, value, session_id }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { media_type, media_id, value, session_id } = body;

    if (!media_type || !media_id || !value || !session_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const url = new URL(`${TMDB_BASE}/${media_type}/${media_id}/rating`);
    url.searchParams.set("guest_session_id", session_id);
    if (!TMDB_ACCESS_TOKEN && TMDB_API_KEY) {
      url.searchParams.set("api_key", TMDB_API_KEY);
    }

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ value }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Rating failed" }, { status: 500 });
  }
}
