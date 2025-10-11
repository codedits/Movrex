import { NextRequest, NextResponse } from 'next/server';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;

// Simple proxy that forwards any path under /api/tmdb/... to TMDB while keeping the key server-side
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    // path after /api/tmdb
    const path = url.pathname.replace(/\/api\/tmdb\/?/, '');

    const targetUrl = new URL(`${TMDB_BASE}/${path}`);
    // Forward query params
    url.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

    // If a token is available prefer Authorization header (v4) otherwise attach api_key
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'Movrex/1.0',
    };

    if (TMDB_ACCESS_TOKEN) {
      headers['Authorization'] = `Bearer ${TMDB_ACCESS_TOKEN}`;
    } else if (TMDB_API_KEY) {
      targetUrl.searchParams.set('api_key', TMDB_API_KEY);
    } else {
      return NextResponse.json({ error: 'TMDB key not configured' }, { status: 500 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(targetUrl.toString(), { signal: controller.signal, headers });
    clearTimeout(timeoutId);

    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 408 });
    }
    console.error('TMDB proxy error:', err);
    return NextResponse.json({ error: 'TMDB proxy failed', details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

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
