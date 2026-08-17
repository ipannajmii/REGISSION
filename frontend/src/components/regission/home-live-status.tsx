"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getStoredToken } from "@/lib/auth";

type Game = {
  id: number;
  status: "ongoing" | "completed";
};

type Device = {
  id: number;
  name: string;
  online: boolean;
  latency_ms?: number | null;
  active_game?: {
    id: number;
    name: string;
    status: string;
  } | null;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy/api";

async function apiGet<T>(
  path: string,
  token: string
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function useHomeLiveStatus() {
  const [games, setGames] = useState<Game[]>([]);
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getStoredToken("user");

    if (!token) {
      setGames([]);
      setDevice(null);
      setLoading(false);
      return;
    }

    try {
      const [gamesResult, deviceResult] = await Promise.all([
        apiGet<Game[]>("/games", token),
        apiGet<{ device: Device }>("/device", token),
      ]);

      setGames(gamesResult);
      setDevice(deviceResult.device);
    } catch {
      setGames([]);
      setDevice(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const interval = window.setInterval(() => {
      void load();
    }, 15000);

    window.addEventListener("regission-auth-change", load);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("regission-auth-change", load);
    };
  }, [load]);

  const activeGames = useMemo(
    () => games.filter((game) => game.status === "ongoing").length,
    [games]
  );

  return {
    activeGames,
    device,
    loading,
  };
}

function formatLatency(value?: number | null) {
  if (typeof value !== "number") {
    return "Waiting";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(2)} s`;
}

export function ActiveGamesValue() {
  const { activeGames, loading } = useHomeLiveStatus();

  return <>{loading ? "â€”" : activeGames}</>;
}

export function AverageLatencyValue() {
  const { device, loading } = useHomeLiveStatus();

  return (
    <>
      {loading
        ? "â€”"
        : device?.online
          ? formatLatency(device.latency_ms)
          : "Offline"}
    </>
  );
}

export function FoxEyeLiveCard() {
  const { device, loading } = useHomeLiveStatus();

  const online = Boolean(device?.online);
  const status = loading
    ? "Checking"
    : online
      ? "Tracking"
      : "Offline";

  return (
    <article className="rounded-3xl border border-white/10 bg-[#0d1829]/85 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-black text-white">Fox Eye (Live)</h2>

        <span
          className={
            online
              ? "rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200"
              : "rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200"
          }
        >
          {status}
        </span>
      </div>

      <div className="mt-6 flex h-56 items-center justify-center rounded-[100px] border border-orange-400/10 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.42),rgba(24,13,15,0.96)_60%)]">
        {online ? (
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-orange-500 shadow-[0_0_55px_rgba(249,115,22,0.5)]">
            <div className="h-14 w-4 rounded-full bg-black" />
          </div>
        ) : (
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-orange-500/35">
            <div className="h-2 w-14 rounded-full bg-black" />
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-xs text-white/40">Detection</p>
          <p className="mt-2 text-sm font-black text-white">
            {online ? "Stable" : "Paused"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-xs text-white/40">Latency</p>
          <p className="mt-2 text-sm font-black text-white">
            {online
              ? formatLatency(device?.latency_ms)
              : "Offline"}
          </p>
        </div>
      </div>

      <Link
        href="/device"
        className="mt-4 block rounded-2xl bg-orange-500 px-5 py-3 text-center text-sm font-black text-black transition hover:bg-orange-400"
      >
        {online
          ? "Raspberry Pi Connected"
          : "Connect Raspberry Pi"}
      </Link>
    </article>
  );
}