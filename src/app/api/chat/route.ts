import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.PAXSENIX_API_KEY;
    const endpoint = process.env.PAXSENIX_ENDPOINT;
    const fallbackEndpoint = process.env.PAXSENIX_FALLBACK_ENDPOINT;

    if (!apiKey || !endpoint || !fallbackEndpoint) {
      console.error("Missing server configuration");
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Trim transcript to a safe length for a GET param (avoid very long URLs for upstream)
    const MAX_LEN = 900;
    let payload = text;
    if (typeof payload === 'string' && payload.length > MAX_LEN) {
      // prefer to keep the most recent context
      payload = payload.slice(payload.length - MAX_LEN);
    }

    const fetchFromPaxsenix = async (url: string, payloadStr: string, timeoutMs: number) => {
      const targetUrl = `${url}?text=${encodeURIComponent(payloadStr)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    try {
      // Try Primary (Gemini)
      const res = await fetchFromPaxsenix(endpoint, payload, 15000);
      if (!res.ok) throw new Error(`Primary API error: ${res.status}`);
      const data = await res.json();
      
      // Check for application-level error (e.g. "busy")
      if (data && typeof data === 'object' && data.ok === false && data.message?.includes('busy')) {
          console.warn("Primary API busy, forcing fallback...");
          throw new Error("Primary API busy");
      }
      
      return NextResponse.json(data);
    } catch (primaryError: any) {
      console.warn("Primary API failed, trying fallback...", primaryError.message);
      
      // Try Fallback (GPT-4o)
      try {
        const res = await fetchFromPaxsenix(fallbackEndpoint, payload, 15000);
        if (!res.ok) {
           const text = await res.text();
           throw new Error(`Fallback API error: ${res.status} ${text}`);
        }
        const data = await res.json();
        return NextResponse.json(data);
      } catch (fallbackError: any) {
         console.error("Fallback API also failed:", fallbackError);
         throw fallbackError;
      }
    }

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
