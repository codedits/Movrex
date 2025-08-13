"use client";

import { useEffect, useRef, useState } from "react";

export type ScrollDirection = "up" | "down";

export default function useScrollDirection(threshold = 8): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>("up");
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      const diff = y - lastY.current;
      if (Math.abs(diff) < threshold) return;
      if (y > lastY.current && y > 64) setDirection("down");
      else setDirection("up");
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return direction;
}





