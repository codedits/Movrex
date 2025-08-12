"use client";

import { useEffect, useState } from "react";

export type ConnectionTier = "low" | "medium" | "high";

type NavigatorWithConnection = Navigator & {
  connection?: Partial<{
    saveData: boolean;
    effectiveType: "slow-2g" | "2g" | "3g" | "4g" | string;
    downlink: number;
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  }>;
};

export default function useConnectionQuality(defaultTier: ConnectionTier = "high"): ConnectionTier {
  const [tier, setTier] = useState<ConnectionTier>(defaultTier);

  useEffect(() => {
    const nav = (typeof navigator !== "undefined" ? (navigator as NavigatorWithConnection) : undefined);
    const conn = nav?.connection;

    const compute = () => {
      if (!conn) return setTier(defaultTier);
      const save = !!conn.saveData;
      const eff: string | undefined = conn.effectiveType; // 'slow-2g' | '2g' | '3g' | '4g'
      const down: number = typeof conn.downlink === "number" ? conn.downlink : 10;

      if (save || eff === "slow-2g" || eff === "2g" || down < 1) return setTier("low");
      if (eff === "3g" || down < 3) return setTier("medium");
      return setTier("high");
    };

    compute();
    if (conn && typeof conn.addEventListener === "function") {
      conn.addEventListener("change", compute);
      return () => conn.removeEventListener && conn.removeEventListener("change", compute);
    }
  }, [defaultTier]);

  return tier;
}


