"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PageShell from "@/components/page-shell";
import ProtectedRoute from "@/components/auth/protected-route";
import { getStoredToken } from "@/lib/auth";
import CompletedDeviceAssignmentCleaner from "@/components/regission/CompletedDeviceAssignmentCleaner";

type Game = {
  id: number;
  name: string;
  status: "ongoing" | "completed";
  updated_at?: string;
  moves?: Array<{
    id: number;
    notation: string;
  }>;
};

type DevicePayload = {
  id: number;
  name: string;
  enabled: boolean;
  online: boolean;
  last_seen_at?: string | null;
  active_game?: Game | null;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy/api";

async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getStoredToken("user");

  if (!token) {
    throw new Error("Your user session has expired.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `Request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload as T;
}


async function setRaspberryPiGame(gameId: number | null): Promise<{
  ok: boolean;
  active_game_id: number | null;
  message: string;
}> {
  const response = await fetch("/api/pi/set-game", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ game_id: gameId }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `Raspberry Pi request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload as {
    ok: boolean;
    active_game_id: number | null;
    message: string;
  };
}

function formatDate(value?: string | null) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function DeviceContent() {
  const [device, setDevice] = useState<DevicePayload | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const ongoingGames = useMemo(
    () => games.filter((game) => game.status === "ongoing"),
    [games]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [deviceResult, gamesResult] = await Promise.all([
        apiRequest<{ device: DevicePayload }>("/device"),
        apiRequest<Game[]>("/games"),
      ]);

      setDevice(deviceResult.device);
      setGames(gamesResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Raspberry Pi information."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();

    const interval = window.setInterval(() => {
      void loadData();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function activate(game: Game) {
    if (
      !window.confirm(
        `Activate "${game.name}" on the Raspberry Pi?\n\nDetected moves will be saved to this game.`
      )
    ) {
      return;
    }

    setWorkingId(game.id);
    setError("");

    try {
      const result = await apiRequest<{
        message: string;
        device: DevicePayload;
      }>(`/games/${game.id}/activate-device`, {
        method: "POST",
      });

      setDevice(result.device);

      try {
        const piResult = await setRaspberryPiGame(game.id);
        setToast(`${result.message} ${piResult.message}`);
      } catch (piError) {
        setToast(result.message);
        setError(
          `Game #${game.id} was assigned in Laravel, but the running Raspberry Pi was not updated: ${
            piError instanceof Error ? piError.message : "Unknown Raspberry Pi error."
          } Start the Pi system, then click “Re-send to Raspberry Pi”.`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to activate the game."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function resendAssignment(game: Game) {
    setWorkingId(game.id);
    setError("");

    try {
      const piResult = await setRaspberryPiGame(game.id);
      setToast(piResult.message);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send the assignment to the Raspberry Pi."
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function deactivate() {
    if (
      !window.confirm(
        "Clear the active Raspberry Pi game assignment?"
      )
    ) {
      return;
    }

    setWorkingId(-1);
    setError("");

    try {
      const result = await apiRequest<{ message: string }>(
        "/device/active-game",
        {
          method: "DELETE",
        }
      );

      setDevice((current) =>
        current
          ? {
              ...current,
              active_game: null,
            }
          : current
      );

      try {
        const piResult = await setRaspberryPiGame(null);
        setToast(`${result.message} ${piResult.message}`);
      } catch (piError) {
        setToast(result.message);
        setError(
          `The Laravel assignment was cleared, but the Raspberry Pi could not be reached: ${
            piError instanceof Error ? piError.message : "Unknown Raspberry Pi error."
          }`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to clear the assignment."
      );
    } finally {
      setWorkingId(null);
    }
  }


  return (
    <PageShell>
      {toast && (
        <div className="fixed right-5 top-24 z-[100] rounded-2xl border border-emerald-400/20 bg-[#10271f] px-5 py-4 text-sm font-bold text-emerald-200 shadow-2xl">
          {toast}
        </div>
      )}

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-400">
            Physical Board Connection
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
            Raspberry Pi
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-white/55">
            Select which ongoing game should receive moves from the
            REGISSION camera system.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading && !device ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-[#0d1829]/85 p-10 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-orange-400" />
            <p className="mt-4 text-sm text-white/45">
              Checking Raspberry Pi...
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-[#0d1829]/85 p-6">
                <p className="text-sm text-white/45">Device</p>
                <p className="mt-3 text-xl font-black text-white">
                  {device?.name ?? "REGISSION Raspberry Pi"}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#0d1829]/85 p-6">
                <p className="text-sm text-white/45">Connection</p>
                <p
                  className={
                    device?.online
                      ? "mt-3 text-xl font-black text-emerald-300"
                      : "mt-3 text-xl font-black text-amber-300"
                  }
                >
                  <RegissionLivePresence lastSeenAt={device?.last_seen_at} />
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#0d1829]/85 p-6">
                <p className="text-sm text-white/45">Last seen</p>
                <p className="mt-3 text-base font-bold text-white">
                  {formatDate(device?.last_seen_at)}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-orange-400/20 bg-orange-500/10 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">
                Active Game
              </p>

              {device?.active_game ? (
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-white">
                      {device.active_game.name}
                    </h2>
                    <p className="mt-2 text-sm text-white/55">
                      Game #{device.active_game.id} {"\u00B7"} {device.active_game.moves?.length ?? 0} recorded moves
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      disabled={workingId === device.active_game.id}
                      onClick={() => void resendAssignment(device.active_game!)}
                      className="rounded-2xl border border-orange-400/25 bg-orange-500/15 px-5 py-3 text-sm font-bold text-orange-100 transition hover:bg-orange-500/25 disabled:opacity-40"
                    >
                      {workingId === device.active_game.id
                        ? "Sending..."
                        : "Re-send to Raspberry Pi"}
                    </button>

                    <button
                      type="button"
                      disabled={workingId === -1}
                      onClick={() => void deactivate()}
                      className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/20 disabled:opacity-40"
                    >
                      {workingId === -1
                        ? "Clearing..."
                        : "Clear Assignment"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-base text-white/60">
                  No game is currently assigned to the Raspberry Pi.
                </p>
              )}
            </div>

            <div className="mt-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white">
                    Ongoing Games
                  </h2>
                  <p className="mt-2 text-sm text-white/45">
                    Choose one game for physical-board move detection.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/70"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {ongoingGames.map((game) => {
                  const active =
                    device?.active_game?.id === game.id;

                  return (
                    <article
                      key={game.id}
                      className={
                        active
                          ? "rounded-3xl border border-orange-400/35 bg-orange-500/10 p-5"
                          : "rounded-3xl border border-white/10 bg-[#0d1829]/85 p-5"
                      }
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-white/35">
                            Game #{game.id}
                          </p>
                          <h3 className="mt-2 text-xl font-black text-white">
                            {game.name}
                          </h3>
                          <p className="mt-2 text-sm text-white/45">
                            {game.moves?.length ?? 0} recorded moves
                          </p>
                        </div>

                        {active && (
                          <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-black">
                            Active
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={workingId === game.id}
                        onClick={() =>
                          void (active
                            ? resendAssignment(game)
                            : activate(game))
                        }
                        className="mt-5 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {workingId === game.id
                          ? active
                            ? "Sending..."
                            : "Activating..."
                          : active
                          ? "Re-send to Raspberry Pi"
                          : "Activate on Raspberry Pi"}
                      </button>
                    </article>
                  );
                })}

                {ongoingGames.length === 0 && (
                  <div className="col-span-full rounded-3xl border border-white/10 bg-[#0d1829]/85 p-10 text-center">
                    <p className="text-lg font-bold text-white">
                      No ongoing games
                    </p>
                    <p className="mt-2 text-sm text-white/40">
                      Create a game from the Game Board first.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </PageShell>
  );
}


// REGISSION_DYNAMIC_PRESENCE_V2
const REGISSION_ONLINE_WINDOW_MS = 40_000;
const REGISSION_REFRESH_INTERVAL_MS = 12_000;

function RegissionLivePresence({
  lastSeenAt,
}: {
  lastSeenAt?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const clockTimer = window.setInterval(() => {
      setNow(Date.now());
    }, 5_000);

    // Update device data in the background without reloading the page.
    // This triggers the page's existing Refresh button handler.
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      const refreshButton = Array.from(
        document.querySelectorAll("button"),
      ).find((button) => {
        return (
          button.textContent?.trim().toLowerCase() === "refresh"
        );
      });

      if (
        refreshButton instanceof HTMLButtonElement &&
        !refreshButton.disabled
      ) {
        refreshButton.click();
      }
    }, REGISSION_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
    };
  }, []);

  const lastSeenMs = lastSeenAt
    ? Date.parse(lastSeenAt)
    : Number.NaN;

  const ageMs = now - lastSeenMs;

  const online =
    Number.isFinite(lastSeenMs) &&
    ageMs >= -15_000 &&
    ageMs <= REGISSION_ONLINE_WINDOW_MS;

  return (
    <span
      aria-live="polite"
      style={{
        color: online ? "#5ee9b5" : "#fbbf24",
        fontWeight: 800,
      }}
    >
      {online ? "Online" : "Offline"}
    </span>
  );
}


// REGISSION_DEVICE_AUTH_BRIDGE_V1
function readRegissionStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const preferredKeys = [
    "regission_token",
    "auth_token",
    "access_token",
    "token",
    "regission-auth-token",
    "regissionAuthToken",
  ];

  const extractToken = (raw: string | null): string | null => {
    if (!raw?.trim()) {
      return null;
    }

    const value = raw.trim();

    try {
      const parsed = JSON.parse(value) as unknown;

      if (typeof parsed === "string" && parsed.trim()) {
        return parsed.trim();
      }

      if (parsed && typeof parsed === "object") {
        const object = parsed as Record<string, unknown>;

        for (const key of [
          "token",
          "access_token",
          "accessToken",
          "auth_token",
        ]) {
          const candidate = object[key];

          if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
          }
        }
      }
    } catch {
      // Plain Sanctum tokens are not JSON.
    }

    return value;
  };

  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (const key of preferredKeys) {
      const token = extractToken(storage.getItem(key));

      if (token) {
        return token;
      }
    }

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (!key || !key.toLowerCase().includes("token")) {
        continue;
      }

      const token = extractToken(storage.getItem(key));

      if (token) {
        return token;
      }
    }
  }

  return null;
}

export default function DevicePage() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = async (
      input: RequestInfo | URL,
      init: RequestInit = {},
    ): Promise<Response> => {
      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      const isRegissionDeviceRequest =
        requestUrl.includes("/api/pi/") ||
        requestUrl.includes("/api/proxy/api/device") ||
        requestUrl.includes("/api/proxy/api/games/");

      if (!isRegissionDeviceRequest) {
        return nativeFetch(input, init);
      }

      const inheritedHeaders =
        input instanceof Request ? input.headers : undefined;

      const headers = new Headers(inheritedHeaders);

      if (init.headers) {
        new Headers(init.headers).forEach((value, key) => {
          headers.set(key, value);
        });
      }

      const token = readRegissionStoredToken();

      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
      }

      return nativeFetch(input, {
        ...init,
        headers,
        credentials: init.credentials ?? "include",
        cache: init.cache ?? "no-store",
      });
    };

    return () => {
      window.fetch = nativeFetch;
    };
  }, []);


  return (
    <ProtectedRoute role="user">
      {/* REGISSION_COMPLETED_DEVICE_ASSIGNMENT_CLEANER_V1 */}
      <CompletedDeviceAssignmentCleaner />
      <DeviceContent />
    </ProtectedRoute>
  );
}