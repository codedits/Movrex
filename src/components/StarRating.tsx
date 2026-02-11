"use client";

import { useState, useCallback } from "react";

const GUEST_SESSION_KEY = "tmdb_guest_session";

type StoredSession = { id: string; expiresAt: string };

function getStoredSession(): string | null {
  try {
    const raw = localStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return null;
    const parsed: StoredSession = JSON.parse(raw);
    if (new Date(parsed.expiresAt) < new Date()) {
      localStorage.removeItem(GUEST_SESSION_KEY);
      return null;
    }
    return parsed.id;
  } catch {
    return null;
  }
}

export default function StarRating({
  mediaId,
  mediaType = "movie",
}: {
  mediaId: number;
  mediaType?: "movie" | "tv";
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRate = useCallback(
    async (value: number) => {
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        let sessionId = getStoredSession();
        if (!sessionId) {
          const sessionRes = await fetch("/api/rate?action=session");
          const sessionData = await sessionRes.json();
          if (!sessionData.guest_session_id) throw new Error("Failed to create session");
          sessionId = sessionData.guest_session_id;
          localStorage.setItem(
            GUEST_SESSION_KEY,
            JSON.stringify({ id: sessionId, expiresAt: sessionData.expires_at })
          );
        }
        const res = await fetch("/api/rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: mediaType,
            media_id: mediaId,
            value: value * 2, // TMDB uses 0.5-10 scale
            session_id: sessionId,
          }),
        });
        if (!res.ok) throw new Error("Rating failed");
        setRating(value);
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 2500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Rating failed");
        setTimeout(() => setError(null), 3000);
      } finally {
        setSubmitting(false);
      }
    },
    [mediaId, mediaType, submitting]
  );

  const stars = [1, 2, 3, 4, 5];
  const displayValue = hovered || rating;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/50 mr-1">Rate:</span>
      <div className="flex items-center gap-0.5">
        {stars.map((star) => (
          <button
            key={star}
            disabled={submitting}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => handleRate(star)}
            className="p-0.5 transition-transform duration-150 disabled:opacity-50 hover:scale-125"
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          >
            <svg
              className={`w-5 h-5 transition-colors duration-150 ${
                star <= displayValue ? "text-yellow-400" : "text-white/20"
              }`}
              fill={star <= displayValue ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </button>
        ))}
      </div>
      {submitting && <span className="text-xs text-white/50 animate-pulse">Rating...</span>}
      {submitted && <span className="text-xs text-green-400">Rated!</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
      {rating > 0 && !submitting && !submitted && !error && (
        <span className="text-xs text-white/50">Your rating: {rating}/5</span>
      )}
    </div>
  );
}
