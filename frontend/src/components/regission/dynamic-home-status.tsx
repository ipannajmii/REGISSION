"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import FoxEyeLive from "@/components/regission/fox-eye-live";
import { getStoredToken } from "@/lib/auth";

type ActiveGame = {
  id: number;
  name: string;
  status?: string;
};

type GameRecord = {
  id: number;
  name?: string;
  status?: string;
};

type GamesResponse =
  | GameRecord[]
  | {
      games?: GameRecord[];
      data?: GameRecord[];
      items?: GameRecord[];
    };

type DeviceResponse = {
  device?: {
    id?: number;
    name?: string;
  } | null;
  device_online?: boolean;
  session_active?: boolean;
  active_game?: ActiveGame | null;
  latency_ms?: number | null;
  last_seen_at?: string | null;
};

type Snapshot = {
  loaded: boolean;
  deviceOnline: boolean;
  sessionActive: boolean;
  activeGame: ActiveGame | null;
  latencyMs: number | null;
  totalGames: number;
  error: string | null;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy/api";

const SERVER_SNAPSHOT: Snapshot = Object.freeze({
  loaded: false,
  deviceOnline: false,
  sessionActive: false,
  activeGame: null,
  latencyMs: null,
  totalGames: 0,
  error: null,
});

let snapshot: Snapshot = SERVER_SNAPSHOT;
let started = false;
let requestRunning = false;
let refreshTimer: number | null = null;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(next: Snapshot) {
  const unchanged =
    snapshot.loaded === next.loaded &&
    snapshot.deviceOnline === next.deviceOnline &&
    snapshot.sessionActive === next.sessionActive &&
    snapshot.activeGame?.id === next.activeGame?.id &&
    snapshot.activeGame?.name === next.activeGame?.name &&
    snapshot.latencyMs === next.latencyMs &&
    snapshot.totalGames === next.totalGames &&
    snapshot.error === next.error;

  if (unchanged) return;

  snapshot = next;
  emit();
}

async function fetchDevice(token: string): Promise<DeviceResponse> {
  const response = await fetch(
    `${API_BASE}/device/status-stable`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `Device request failed: ${response.status}`;

    throw new Error(message);
  }

  return (payload ?? {}) as DeviceResponse;
}

async function fetchGames(token: string): Promise<GameRecord[]> {
  const response = await fetch(`${API_BASE}/games`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | GamesResponse
    | null;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `Games request failed: ${response.status}`;

    throw new Error(message);
  }

  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.games)) return payload.games;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.items)) return payload.items;

  return [];
}

async function refreshDeviceStatus() {
  if (requestRunning) return;

  const token = getStoredToken("user");

  if (!token) {
    setSnapshot({
      loaded: true,
      deviceOnline: false,
      sessionActive: false,
      activeGame: null,
      latencyMs: null,
      totalGames: 0,
      error: "User session unavailable.",
    });
    return;
  }

  requestRunning = true;

  try {
    const [data, games] = await Promise.all([
      fetchDevice(token),
      fetchGames(token),
    ]);

    const activeGame = data.active_game ?? null;
    const deviceOnline = Boolean(data.device_online);

    // Laravel/MySQL is the single source of truth.
    // A session is active only when the device is online and Laravel
    // confirms that an ongoing game is assigned to this Raspberry Pi.
    const sessionActive =
      Boolean(data.session_active) &&
      deviceOnline &&
      activeGame !== null;

    setSnapshot({
      loaded: true,
      deviceOnline,
      sessionActive,
      activeGame,
      latencyMs:
        typeof data.latency_ms === "number"
          ? data.latency_ms
          : null,
      totalGames: games.length,
      error: null,
    });
  } catch (error) {
    setSnapshot({
      ...snapshot,
      loaded: true,
      deviceOnline: false,
      sessionActive: false,
      activeGame: null,
      latencyMs: null,
      totalGames: 0,
      error:
        error instanceof Error
          ? error.message
          : "Unable to read Raspberry Pi status.",
    });
  } finally {
    requestRunning = false;
  }
}

function handleRefreshEvent() {
  void refreshDeviceStatus();
}

function startStore() {
  if (started || typeof window === "undefined") return;

  started = true;
  void refreshDeviceStatus();

  refreshTimer = window.setInterval(() => {
    void refreshDeviceStatus();
  }, 10000);

  window.addEventListener("focus", handleRefreshEvent);
  window.addEventListener("storage", handleRefreshEvent);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshDeviceStatus();
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  startStore();

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

function useStatus() {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
}

function formatLatency(value: number | null) {
  if (value === null) return "Waiting";

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  return `${(value / 1000).toFixed(2)} s`;
}

export function DynamicSystemBadge() {
  const state = useStatus();

  const text = !state.loaded
    ? "Checking REGISSION status..."
    : state.sessionActive
      ? `Tracking ${state.activeGame?.name ?? "assigned game"}`
      : state.deviceOnline
        ? "Raspberry Pi online - no game assigned"
        : "Raspberry Pi offline";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur">
      <span
        className={
          state.sessionActive
            ? "h-2 w-2 rounded-full bg-emerald-400"
            : state.deviceOnline
              ? "h-2 w-2 rounded-full bg-amber-400"
              : "h-2 w-2 rounded-full bg-red-400"
        }
      />
      {text}
    </span>
  );
}

export function DynamicTotalGames() {
  const state = useStatus();

  if (!state.loaded) return <>Checking...</>;

  return <>{state.totalGames}</>;
}

// Kept for compatibility with the existing home page import.
// It now displays the total number of games returned by Laravel.
export function DynamicActiveGames() {
  return <DynamicTotalGames />;
}

export function DynamicLatency() {
  const state = useStatus();

  if (!state.loaded) return <>Checking...</>;

  return state.deviceOnline
    ? <>{formatLatency(state.latencyMs)}</>
    : <>Offline</>;
}

export function DynamicFoxEyeCard() {
  const state = useStatus();
  const eyeOpen = state.sessionActive;

  const actionHref = state.activeGame
    ? `/device?game_id=${state.activeGame.id}`
    : "/device";

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111827]/70 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white/90">
          Fox Eye (Live)
        </p>

        <span
          className={
            eyeOpen
              ? "rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200"
              : state.deviceOnline
                ? "rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200"
                : "rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200"
          }
        >
          {eyeOpen
            ? "Tracking"
            : state.deviceOnline
              ? "Waiting"
              : "Offline"}
        </span>
      </div>

      <div className="mt-4">
        {eyeOpen ? (
          <FoxEyeLive />
        ) : (
          <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-[92px] border border-orange-400/10 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.28),rgba(29,17,17,0.98)_62%)]">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-orange-500/35">
              <div className="h-2 w-14 rounded-full bg-black" />
            </div>
          </div>
        )}
      </div>

      <Link
        href={actionHref}
        className="mt-4 block rounded-xl border border-orange-400/25 bg-orange-500/10 px-5 py-3 text-center text-sm font-extrabold text-orange-200 transition hover:bg-orange-500/20"
      >
        {eyeOpen
          ? `Active: ${state.activeGame?.name ?? "Assigned Game"}`
          : state.deviceOnline
            ? "Assign a Game to Raspberry Pi"
            : "Open Raspberry Pi Setup"}
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-black/15 p-4">
          <p className="text-xs text-white/45">Detection</p>
          <p className="mt-1 font-semibold text-white">
            {eyeOpen ? "Stable" : "Paused"}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/15 p-4">
          <p className="text-xs text-white/45">Latency</p>
          <p className="mt-1 font-semibold text-white">
            {state.deviceOnline
              ? formatLatency(state.latencyMs)
              : "Offline"}
          </p>
        </div>
      </div>
    </div>
  );
}
