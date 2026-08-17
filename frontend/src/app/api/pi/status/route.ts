// REGISSION_HIDE_TRANSIENT_RECONNECT_MESSAGE_V1
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StatusPayload = Record<string, unknown>;

const LIVE_CACHE_GRACE_MS = 90_000;

let lastLiveStatus: StatusPayload | null = null;
let lastLiveAt = 0;

function piBaseUrl(): string {
  return (process.env.RPI_BASE_URL || "http://127.0.0.1:15051")
    .replace(/\/+$/, "");
}

function backendBaseUrl(): string {
  return (process.env.BACKEND_URL || "http://127.0.0.1:8080")
    .replace(/\/+$/, "");
}

async function fetchJson(
  url: string,
  timeoutMs: number,
): Promise<StatusPayload> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await response.text();

    if (!response.ok) {
      throw new Error(
        `${url} returned HTTP ${response.status}: ${raw}`,
      );
    }

    return raw.trim()
      ? (JSON.parse(raw) as StatusPayload)
      : {};
  } finally {
    clearTimeout(timer);
  }
}

function activeGameId(
  live: StatusPayload | null,
  cloud: StatusPayload | null,
): number | null {
  const candidate =
    live?.active_game_id ??
    live?.game_id ??
    cloud?.active_game_id ??
    cloud?.game_id ??
    null;

  const value = Number(candidate);

  return Number.isInteger(value) && value > 0
    ? value
    : null;
}

function cloudOnline(cloud: StatusPayload | null): boolean {
  const heartbeat =
    cloud?.heartbeat &&
    typeof cloud.heartbeat === "object"
      ? (cloud.heartbeat as StatusPayload)
      : null;

  return Boolean(
    cloud?.online ??
    cloud?.connected ??
    heartbeat?.online ??
    false,
  );
}

function normalizeLive(
  live: StatusPayload,
  cloud: StatusPayload | null,
  source: string,
  reconnecting: boolean,
): StatusPayload {
  const gameId = activeGameId(live, cloud);

  const detectionEnabled = Boolean(live.detection_enabled);
  const autoEnabled = Boolean(live.auto_enabled);
  const boardLocked = Boolean(live.board_locked);
  const syncRequired = Boolean(live.sync_required);

  return {
    ...(cloud ?? {}),
    ...live,
    source,
    online: true,
    connected: true,
    tunnel_online: !reconnecting,
    reconnecting,
    active_game_id: gameId,
    game_id: gameId,
    game_assigned: Boolean(gameId),
    has_active_game: Boolean(gameId),
    detection_enabled: detectionEnabled,
    auto_enabled: autoEnabled,
    board_locked: boardLocked,
    sync_required: syncRequired,
    detection_mode: autoEnabled
      ? "AUTO ON"
      : detectionEnabled
        ? "MANUAL ON"
        : "PAUSED",
    safe_to_move:
      boardLocked &&
      !syncRequired &&
      (autoEnabled || detectionEnabled),
  };
}

export async function GET(): Promise<Response> {
  const now = Date.now();

  let cloud: StatusPayload | null = null;

  try {
    cloud = await fetchJson(
      `${backendBaseUrl()}/api/device/dashboard-status`,
      5_000,
    );
  } catch {
    cloud = null;
  }

  try {
    const live = await fetchJson(
      `${piBaseUrl()}/status`,
      6_000,
    );

    lastLiveStatus = live;
    lastLiveAt = now;

    return NextResponse.json(
      normalizeLive(
        live,
        cloud,
        "live_pi_tunnel",
        false,
      ),
      {
        status: 200,
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Temporary Raspberry Pi tunnel interruption.";

    const cacheAgeMs = now - lastLiveAt;

    if (
      lastLiveStatus &&
      cacheAgeMs >= 0 &&
      cacheAgeMs <= LIVE_CACHE_GRACE_MS
    ) {
      return NextResponse.json(
        {
          ...normalizeLive(
            lastLiveStatus,
            cloud,
            "live_pi_cache",
            true,
          ),
          live_status_error: message,
          live_status_age_ms: cacheAgeMs,
          message:
            (
            typeof lastLiveStatus.message === "string" &&
            lastLiveStatus.message.trim()
              ? lastLiveStatus.message
              : "Raspberry Pi detection remains active."
          ),
        },
        {
          status: 200,
          headers: {
            "cache-control": "no-store, no-cache, must-revalidate",
          },
        },
      );
    }

    const gameId = activeGameId(null, cloud);
    const heartbeatOnline = cloudOnline(cloud);

    return NextResponse.json(
      {
        ...(cloud ?? {}),
        source: "laravel_heartbeat_fallback",
        online: heartbeatOnline,
        connected: heartbeatOnline,
        tunnel_online: false,
        reconnecting: true,
        active_game_id: gameId,
        game_id: gameId,
        game_assigned: Boolean(gameId),
        has_active_game: Boolean(gameId),
        detection_enabled: false,
        auto_enabled: false,
        board_locked: false,
        detection_mode: "PAUSED",
        safe_to_move: false,
        live_status_error: message,
        message: heartbeatOnline
          ? "Raspberry Pi heartbeat is online."
          : "Raspberry Pi connection is unavailable.",
      },
      {
        status: 200,
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }
}
