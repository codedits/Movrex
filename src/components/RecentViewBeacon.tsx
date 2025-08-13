"use client";

import { useEffect } from "react";

const EXPIRY_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

export default function RecentViewBeacon({
  id,
  title,
  posterPath,
}: {
  id: number;
  title: string;
  posterPath: string | null;
}) {
  useEffect(() => {
    try {
      const key = "recent_views";
      const raw = localStorage.getItem(key);
      const list: Array<{ id: number; title: string; poster_path: string | null; ts: number }> = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      const cutoff = now - EXPIRY_MS;
      const notExpired = list.filter((x) => x.ts >= cutoff);
      const filtered = notExpired.filter((x) => x.id !== id);
      filtered.unshift({ id, title, poster_path: posterPath, ts: now });
      const capped = filtered.slice(0, 12);
      localStorage.setItem(key, JSON.stringify(capped));
    } catch {}
  }, [id, title, posterPath]);

  return null;
}
