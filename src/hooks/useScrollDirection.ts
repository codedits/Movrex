"use client";

import { useEffect, useRef, useState } from "react";

export type ScrollDirection = "up" | "down";

export default function useScrollDirection(threshold = 8): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>("up");
  const lastY = useRef(0);
  const lastKnownY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const process = () => {
      const y = lastKnownY.current;
      const diff = y - lastY.current;
      if (Math.abs(diff) >= threshold) {
        if (y > lastY.current && y > 64) setDirection("down");
        else setDirection("up");
        lastY.current = y;
      }
      ticking.current = false;
    };

    const onScroll = () => {
      lastKnownY.current = window.scrollY || 0;
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(process);
      }
    };

    // initialize
    lastY.current = window.scrollY || 0;
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return direction;
}





