"use client";

import { useEffect, useState } from "react";
import { getStoredToken } from "@/lib/auth";

type Game = {
  id: number;
  status: "ongoing" | "completed";
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy/api";

export default function ActiveGamesStat() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCount() {
      const token = getStoredToken("user");

      if (!token) {
        if (active) setCount(0);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/games`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          if (active) setCount(0);
          return;
        }

        const games = (await response.json()) as Game[];

        if (active) {
          setCount(
            games.filter((game) => game.status === "ongoing").length
          );
        }
      } catch {
        if (active) setCount(0);
      }
    }

    void loadCount();

    window.addEventListener("regission-auth-change", loadCount);

    return () => {
      active = false;
      window.removeEventListener(
        "regission-auth-change",
        loadCount
      );
    };
  }, []);

  return <>{count === null ? "â€”" : count}</>;
}