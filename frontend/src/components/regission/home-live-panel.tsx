"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import FoxEyeLive from "@/components/regission/fox-eye-live";
import { getStoredToken } from "@/lib/auth";

type Game = {
  id: number;
  status: "ongoing" | "completed";
};

type Device = {
  online: boolean;
  latency_ms?: number | null;
};

type LiveState = {
  activeGames: number;
  deviceOnline: boolean;
  latencyMs: number | null;
  loaded: boolean;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy/api";

const CACHE_KEY = "regission_home_live_v3";

async function apiGet<T>(
  path: string,
  token: string,
  signal: AbortSignal
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function readCache(): LiveState {
  const fallback: LiveState = {
    activeGames: 0,
    deviceOnline: false,
    latencyMs: null,
    loaded: false,
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<LiveState>;

    return {
      activeGames:
        typeof parsed.activeGames === "number"
          ? parsed.activeGames
          : 0,
      deviceOnline: false,
      latencyMs:
        typeof parsed.latencyMs === "number"
          ? parsed.latencyMs
          : null,
      loaded: true,
    };
  } catch {
    return fallback;
  }
}

function formatLatency(value: number | null) {
  if (value === null) return "Waiting";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

export default function HomeLivePanel() {
  const [state, setState] = useState<LiveState>(() => readCache());
  const requestRunning = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (requestRunning.current) {
      return;
    }

    const token = getStoredToken("user");

    if (!token) {
      const signedOut: LiveState = {
        activeGames: 0,
        deviceOnline: false,
        latencyMs: null,
        loaded: true,
      };

      setState(signedOut);
      window.localStorage.setItem(
        CACHE_KEY,
        JSON.stringify(signedOut)
      );
      return;
    }

    requestRunning.current = true;
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const [games, devicePayload] = await Promise.all([
        apiGet<Game[]>("/games", token, controller.signal),
        apiGet<{ device: Device }>(
          "/device",
          token,
          controller.signal
        ),
      ]);

      const next: LiveState = {
        activeGames: games.filter(
          (game) => game.status === "ongoing"
        ).length,
        deviceOnline: Boolean(devicePayload.device.online),
        latencyMs:
          typeof devicePayload.device.latency_ms === "number"
            ? devicePayload.device.latency_ms
            : null,
        loaded: true,
      };

      setState(next);

      window.localStorage.setItem(
        CACHE_KEY,
        JSON.stringify(next)
      );
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      // Keep the last successful game count.
      // Only mark the physical device offline.
      setState((current) => ({
        ...current,
        deviceOnline: false,
        loaded: true,
      }));
    } finally {
      requestRunning.current = false;
    }
  }, []);

  useEffect(() => {
    void load();

    const interval = window.setInterval(() => {
      void load();
    }, 15000);

    function handleAuthChange() {
      void load();
    }

    window.addEventListener(
      "regission-auth-change",
      handleAuthChange
    );

    return () => {
      window.clearInterval(interval);
      abortRef.current?.abort();

      window.removeEventListener(
        "regission-auth-change",
        handleAuthChange
      );
    };
  }, [load]);

  const latencyText = state.deviceOnline
    ? formatLatency(state.latencyMs)
    : "Offline";

  return (
    <>
      <div className="mt-8 grid max-w-xl grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="text-xs text-white/45">
            Active games
          </p>

          <p className="mt-2 text-xl font-black text-white">
            {state.loaded ? state.activeGames : "â€”"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="text-xs text-white/45">
            Avg latency
          </p>

          <p className="mt-2 text-xl font-black text-white">
            {state.loaded ? latencyText : "â€”"}
          </p>
        </div>
      </div>

      <div className="hidden">
        {state.activeGames}
      </div>
    </>
  );
}

export function FoxEyeStatusCard() {
  const [state, setState] = useState<LiveState>(() => readCache());
  const requestRunning = useRef(false);

  const load = useCallback(async () => {
    if (requestRunning.current) return;

    const token = getStoredToken("user");

    if (!token) {
      setState((current) => ({
        ...current,
        deviceOnline: false,
        loaded: true,
      }));
      return;
    }

    requestRunning.current = true;
    const controller = new AbortController();

    try {
      const payload = await apiGet<{ device: Device }>(
        "/device",
        token,
        controller.signal
      );

      setState((current) => ({
        ...current,
        deviceOnline: Boolean(payload.device.online),
        latencyMs:
          typeof payload.device.latency_ms === "number"
            ? payload.device.latency_ms
            : current.latencyMs,
        loaded: true,
      }));
    } catch {
      setState((current) => ({
        ...current,
        deviceOnline: false,
        loaded: true,
      }));
    } finally {
      requestRunning.current = false;
    }
  }, []);

  useEffect(() => {
    void load();

    const interval = window.setInterval(() => {
      void load();
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [load]);

  const online = state.deviceOnline;

  return (
    <article className="rounded-3xl border border-white/10 bg-[#0d1829]/85 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-black text-white">
          Fox Eye (Live)
        </h2>

        <span
          className={
            online
              ? "rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200"
              : "rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200"
          }
        >
          {online ? "Tracking" : "Offline"}
        </span>
      </div>

      <div className="mt-5">
        {online ? (
          <FoxEyeLive />
        ) : (
          <div className="flex h-52 items-center justify-center overflow-hidden rounded-[92px] border border-orange-400/10 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.28),rgba(29,17,17,0.98)_62%)]">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-orange-500/35">
              <div className="h-2 w-14 rounded-full bg-black" />
            </div>
          </div>
        )}
      </div>

      <Link
        href="/device"
        className="mt-4 block rounded-2xl border border-orange-400/25 bg-orange-500/10 px-5 py-3 text-center text-sm font-black text-orange-200 transition hover:bg-orange-500/20"
      >
        {online
          ? "Raspberry Pi Connected"
          : "Connect Raspberry Pi"}
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-xs text-white/40">
            Detection
          </p>

          <p className="mt-2 text-sm font-black text-white">
            {online ? "Stable" : "Paused"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <p className="text-xs text-white/40">
            Latency
          </p>

          <p className="mt-2 text-sm font-black text-white">
            {online
              ? formatLatency(state.latencyMs)
              : "Offline"}
          </p>
        </div>
      </div>
    </article>
  );
}