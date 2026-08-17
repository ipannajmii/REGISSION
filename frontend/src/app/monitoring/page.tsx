"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type JsonRecord = Record<string, unknown>;
type CameraMode = "off" | "yolo-board" | "raw-board";

type LatencyRecord = {
  id: number;
  time: string;
  testCase: string;
  source: string;
  status: string;
  piCloudMs: number | null;
  browserCloudMs: number | null;
  moveMs: number | null;
  totalMs: number | null;
  activeGame: string;
  sideToMove: string;
  notes: string;
};

type StreamPanelProps = {
  title: string;
  subtitle: string;
  sources: string[];
  active: boolean;
  online: boolean;
};

const RECORDS_KEY = "regission-monitoring-latency-records-v2";
const MAX_RECORDS = 30;

function asRecord(value: unknown): JsonRecord {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as JsonRecord;
  }

  return {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function firstBoolean(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (
        normalized === "true" ||
        normalized === "online" ||
        normalized === "connected" ||
        normalized === "1"
      ) {
        return true;
      }

      if (
        normalized === "false" ||
        normalized === "offline" ||
        normalized === "disconnected" ||
        normalized === "0"
      ) {
        return false;
      }
    }
  }

  return null;
}

function formatMs(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${Math.round(value)} ms`;
}

function formatSeconds(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  if (value < 60) {
    return `${Math.max(0, Math.round(value))} sec`;
  }

  if (value < 3600) {
    return `${Math.round(value / 60)} min`;
  }

  return `${(value / 3600).toFixed(1)} hr`;
}

function deriveSideToMove(
  status: JsonRecord,
  game: JsonRecord,
): string {
  const explicit = firstString(
    status.side_to_move,
    status.turn,
    game.side_to_move,
    game.turn,
  );

  if (explicit) {
    const normalized = explicit.toLowerCase();

    if (normalized === "w" || normalized.includes("white")) {
      return "White";
    }

    if (normalized === "b" || normalized.includes("black")) {
      return "Black";
    }

    return explicit;
  }

  const fen = firstString(status.fen, game.fen);

  if (fen) {
    const parts = fen.split(/\s+/);

    if (parts[1] === "w") {
      return "White";
    }

    if (parts[1] === "b") {
      return "Black";
    }
  }

  return "—";
}

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

function StreamPanel({
  title,
  subtitle,
  sources,
  active,
  online,
}: StreamPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const sourceKey = sources.join("|");
  const source = sources[index] ?? "";

  useEffect(() => {
    setIndex(0);
    setLoaded(false);
    setFailed(false);
  }, [sourceKey, active, online]);

  const handleError = () => {
    setLoaded(false);

    if (index < sources.length - 1) {
      setIndex((current) => current + 1);
      return;
    }

    setFailed(true);
  };

  const openFullscreen = async () => {
    try {
      await containerRef.current?.requestFullscreen();
    } catch {
      // Fullscreen can be rejected by the browser.
    }
  };

  return (
    <article className="rounded-[26px] border border-white/10 bg-[#101a31] p-5 shadow-[0_26px_80px_rgba(0,0,0,0.28)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-white">{title}</h3>
          <p className="mt-1 text-sm text-white/50">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={openFullscreen}
          disabled={!active || !online || failed}
          className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          Full screen
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative flex min-h-[360px] overflow-hidden rounded-[22px] border border-white/10 bg-black"
      >
        {!active ? (
          <div className="m-auto max-w-md px-8 text-center">
            <p className="text-xl font-black text-white">
              Camera stream is stopped
            </p>
            <p className="mt-2 text-sm leading-6 text-white/50">
              Start a camera mode only when you need the preview. This prevents
              the live monitor from affecting Pi control commands.
            </p>
          </div>
        ) : !online ? (
          <div className="m-auto max-w-md px-8 text-center">
            <p className="text-xl font-black text-white">
              Raspberry Pi tunnel is offline
            </p>
            <p className="mt-2 text-sm leading-6 text-white/50">
              The stream will be available after the heartbeat and SSH tunnel
              reconnect.
            </p>
          </div>
        ) : failed || !source ? (
          <div className="m-auto max-w-md px-8 text-center">
            <p className="text-xl font-black text-white">
              Stream unavailable
            </p>
            <p className="mt-2 text-sm leading-6 text-white/50">
              Stop the cameras, wait a few seconds, then reconnect.
            </p>
          </div>
        ) : (
          <>
            {!loaded ? (
              <div className="absolute inset-0 z-10 grid place-items-center bg-black">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-orange-400" />
                  <p className="mt-4 text-sm font-bold text-white/60">
                    Opening stream...
                  </p>
                </div>
              </div>
            ) : null}

            <img
              key={source}
              src={source}
              alt={`${title} live stream`}
              onLoad={() => {
                setLoaded(true);
                setFailed(false);
              }}
              onError={handleError}
              className="h-full min-h-[360px] w-full object-contain"
            />
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/40">
        <span className="truncate">
          {active && source ? source.split("?")[0] : "No active connection"}
        </span>
        <span>
          {!active
            ? "STOPPED"
            : !online
              ? "OFFLINE"
              : loaded
                ? "LIVE"
                : failed
                  ? "ERROR"
                  : "CONNECTING"}
        </span>
      </div>
    </article>
  );
}

export default function MonitoringPage() {
  const cameraWallRef = useRef<HTMLElement>(null);
  const requestRunningRef = useRef(false);
  const lastSampleAtRef = useRef(0);

  const [status, setStatus] = useState<JsonRecord>({});
  const [statusError, setStatusError] = useState<string | null>(null);
  const [browserCloudMs, setBrowserCloudMs] = useState<number | null>(null);
  const [records, setRecords] = useState<LatencyRecord[]>([]);
  const [cameraMode, setCameraMode] = useState<CameraMode>("off");
  const [streamNonce, setStreamNonce] = useState(() => Date.now());

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(RECORDS_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as LatencyRecord[];

        if (Array.isArray(parsed)) {
          setRecords(parsed.slice(-MAX_RECORDS));
        }
      }
    } catch {
      // Ignore malformed browser storage.
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        RECORDS_KEY,
        JSON.stringify(records.slice(-MAX_RECORDS)),
      );
    } catch {
      // Session storage may be blocked.
    }
  }, [records]);

  const appendRecord = (
    payload: JsonRecord,
    currentBrowserCloudMs: number,
  ) => {
    const now = Date.now();

    if (now - lastSampleAtRef.current < 10000) {
      return;
    }

    lastSampleAtRef.current = now;

    const device = asRecord(payload.device);
    const heartbeat = asRecord(payload.heartbeat);
    const game = asRecord(payload.active_game ?? payload.game);

    const piCloudMs = firstNumber(
      payload.latency_ms,
      device.latency_ms,
      heartbeat.latency_ms,
    );

    const moveMs = firstNumber(
      payload.last_move_latency_ms,
      payload.move_latency_ms,
      payload.processing_latency_ms,
    );

    const availableParts = [piCloudMs, currentBrowserCloudMs, moveMs].filter(
      (value): value is number => value !== null && Number.isFinite(value),
    );

    const totalMs =
      availableParts.length > 0
        ? availableParts.reduce((sum, value) => sum + value, 0)
        : null;

    const online =
      firstBoolean(
        payload.online,
        payload.connected,
        payload.device_online,
        device.online,
        heartbeat.online,
      ) ?? false;

    const tunnel =
      firstBoolean(payload.tunnel_online, payload.service_online) ?? online;

    const activeGame =
      firstString(game.name) ??
      (firstNumber(payload.active_game_id, payload.game_id, game.id)
        ? `Game ${Math.round(
            firstNumber(payload.active_game_id, payload.game_id, game.id) ?? 0,
          )}`
        : "No assigned game");

    const record: LatencyRecord = {
      id: now,
      time: new Date(now).toLocaleString("en-MY"),
      testCase: "Live Hosted Monitor",
      source: "Raspberry Pi / Cloud",
      status: online && tunnel ? "PASS" : "WAIT",
      piCloudMs,
      browserCloudMs: currentBrowserCloudMs,
      moveMs,
      totalMs,
      activeGame,
      sideToMove: deriveSideToMove(payload, game),
      notes:
        firstString(payload.message, payload.status_message) ??
        (online && tunnel
          ? "Heartbeat and tunnel are connected."
          : "Waiting for Raspberry Pi connection."),
    };

    setRecords((current) => [...current, record].slice(-MAX_RECORDS));
  };

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      if (cancelled) {
        return;
      }

      if (document.hidden || requestRunningRef.current) {
        timer = window.setTimeout(tick, 5000);
        return;
      }

      requestRunningRef.current = true;

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 4000);
      const started = performance.now();

      try {
        const response = await fetch(`/api/pi/status?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        const elapsed = Math.round(performance.now() - started);

        if (!response.ok) {
          throw new Error(`Status request returned HTTP ${response.status}.`);
        }

        const payload = asRecord(await response.json());

        if (!cancelled) {
          setStatus(payload);
          setBrowserCloudMs(elapsed);
          setStatusError(null);
          appendRecord(payload, elapsed);
        }
      } catch (error) {
        if (!cancelled) {
          setBrowserCloudMs(null);
          setStatusError(
            error instanceof DOMException && error.name === "AbortError"
              ? "Status request stopped after 4 seconds to protect Pi control commands."
              : error instanceof Error
                ? error.message
                : "Unable to load status.",
          );
        }
      } finally {
        window.clearTimeout(timeout);
        requestRunningRef.current = false;

        if (!cancelled) {
          timer = window.setTimeout(tick, 5000);
        }
      }
    };

    const stopCamerasWhenHidden = () => {
      if (document.hidden) {
        setCameraMode("off");
      }
    };

    const stopCamerasBeforeLeaving = () => {
      setCameraMode("off");
    };

    document.addEventListener("visibilitychange", stopCamerasWhenHidden);
    window.addEventListener("pagehide", stopCamerasBeforeLeaving);

    void tick();

    return () => {
      cancelled = true;

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }

      document.removeEventListener("visibilitychange", stopCamerasWhenHidden);
      window.removeEventListener("pagehide", stopCamerasBeforeLeaving);
    };
  }, []);

  const device = asRecord(status.device);
  const heartbeat = asRecord(status.heartbeat);
  const game = asRecord(status.active_game ?? status.game);

  const online =
    firstBoolean(
      status.online,
      status.connected,
      status.device_online,
      device.online,
      heartbeat.online,
    ) ?? false;

  const tunnelOnline =
    firstBoolean(status.tunnel_online, status.service_online) ?? online;

  const piCloudMs = firstNumber(
    status.latency_ms,
    device.latency_ms,
    heartbeat.latency_ms,
  );

  const moveMs = firstNumber(
    status.last_move_latency_ms,
    status.move_latency_ms,
    status.processing_latency_ms,
  );

  const heartbeatAge = firstNumber(
    status.age_seconds,
    heartbeat.age_seconds,
  );

  const latestTotal = useMemo(() => {
    const parts = [piCloudMs, browserCloudMs, moveMs].filter(
      (value): value is number => value !== null && Number.isFinite(value),
    );

    return parts.length > 0
      ? parts.reduce((sum, value) => sum + value, 0)
      : null;
  }, [piCloudMs, browserCloudMs, moveMs]);

  const averageTotal = useMemo(() => {
    const totals = records
      .map((record) => record.totalMs)
      .filter(
        (value): value is number => value !== null && Number.isFinite(value),
      );

    if (totals.length === 0) {
      return null;
    }

    return totals.reduce((sum, value) => sum + value, 0) / totals.length;
  }, [records]);

  const activeGame =
    firstString(game.name) ??
    (firstNumber(status.active_game_id, status.game_id, game.id)
      ? `Game ${Math.round(
          firstNumber(status.active_game_id, status.game_id, game.id) ?? 0,
        )}`
      : "No assigned game");

  const sideToMove = deriveSideToMove(status, game);
  const detectionMode =
    firstString(status.detection_mode, status.mode) ?? "PAUSED";

  const boardLocked = firstBoolean(status.board_locked) ?? false;
  const autoEnabled = firstBoolean(status.auto_enabled) ?? false;

  const streams = useMemo(
    () => ({
      yolo: [
        `/pi-stream/yolo?t=${streamNonce}`,
        `/pi-stream/overlay?t=${streamNonce}`,
      ],
      raw: [`/pi-stream/video?t=${streamNonce}`],
      board: [`/pi-stream/board?t=${streamNonce}`],
    }),
    [streamNonce],
  );

  const startMode = (mode: CameraMode) => {
    if (!online || !tunnelOnline) {
      setStatusError(
        "The Raspberry Pi tunnel must be connected before opening camera streams.",
      );
      return;
    }

    setStatusError(null);
    setStreamNonce(Date.now());
    setCameraMode(mode);
  };

  const enterCameraWall = async () => {
    if (cameraMode === "off") {
      startMode("yolo-board");
    }

    window.setTimeout(async () => {
      try {
        await cameraWallRef.current?.requestFullscreen();
      } catch {
        // Camera wall remains usable without browser fullscreen.
      }
    }, 80);
  };

  const downloadCsv = () => {
    const headers = [
      "No.",
      "Time",
      "Test Case",
      "Source",
      "Status",
      "Pi to Cloud Latency (ms)",
      "Browser to Cloud API (ms)",
      "Move Processing (ms)",
      "Estimated Total Latency (ms)",
      "Active Game",
      "Side to Move",
      "Notes",
    ];

    const rows = records.map((record, index) => [
      index + 1,
      record.time,
      record.testCase,
      record.source,
      record.status,
      record.piCloudMs ?? "",
      record.browserCloudMs ?? "",
      record.moveMs ?? "",
      record.totalMs ?? "",
      record.activeGame,
      record.sideToMove,
      record.notes,
    ]);

    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\r\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `regission-latency-${Date.now()}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#071023] text-white">
      <header className="border-b border-white/10 bg-[#081126]">
        <div className="mx-auto flex max-w-[1750px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="text-xl font-black">
            REGISSION
            <span className="ml-2 text-xs uppercase tracking-[0.18em] text-orange-300">
              Safe Live Monitor
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-2 text-sm font-bold text-white/65">
            <Link href="/dashboard" className="rounded-xl px-3 py-2 hover:bg-white/[0.06] hover:text-white">
              Game Board
            </Link>
            <Link href="/device" className="rounded-xl px-3 py-2 hover:bg-white/[0.06] hover:text-white">
              Raspberry Pi
            </Link>
            <Link href="/history" className="rounded-xl px-3 py-2 hover:bg-white/[0.06] hover:text-white">
              History
            </Link>
            <span className="rounded-xl bg-orange-500 px-3 py-2 text-white">
              Monitoring
            </span>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-[1750px] px-5 py-10 sm:px-8">
        <div className="rounded-[30px] bg-white p-6 text-slate-900 shadow-[0_30px_100px_rgba(0,0,0,0.3)] sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#8b3b0a]">
                Raspberry Pi Hosted Monitoring
              </p>
              <h1 className="mt-2 text-3xl font-black text-[#7b2e09] sm:text-4xl">
                REGISSION Latency and Delay Testing
              </h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
                Safe monitoring mode. Status requests cannot overlap and stop
                after four seconds. Camera streams remain off until manually
                started.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadCsv}
                disabled={records.length === 0}
                className="rounded-xl bg-[#8b3b0a] px-4 py-2 text-sm font-black text-white disabled:opacity-40"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => setRecords([])}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700"
              >
                Clear records
              </button>
            </div>
          </div>

          {statusError ? (
            <div className="mt-5 rounded-2xl border border-rose-300 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-800">
              {statusError}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-[#fff1b8] p-5">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#754014]">
                Latest Estimated Latency
              </p>
              <p className="mt-2 text-3xl font-black text-[#8b3b0a]">
                {formatMs(latestTotal)}
              </p>
            </div>

            <div className="rounded-2xl bg-[#fff1b8] p-5">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#754014]">
                Average Total Latency
              </p>
              <p className="mt-2 text-3xl font-black text-[#8b3b0a]">
                {formatMs(averageTotal)}
              </p>
            </div>

            <div className="rounded-2xl bg-[#fff1b8] p-5">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#754014]">
                Total Test Records
              </p>
              <p className="mt-2 text-3xl font-black text-[#8b3b0a]">
                {records.length}
              </p>
            </div>

            <div className="rounded-2xl bg-[#fff1b8] p-5">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#754014]">
                Connection
              </p>
              <p className="mt-2 text-xl font-black text-[#8b3b0a]">
                {online && tunnelOnline ? "ONLINE" : "WAITING"}
              </p>
              <p className="mt-1 text-sm text-[#754014]">
                Heartbeat age: {formatSeconds(heartbeatAge)}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm font-black">
            <span className="rounded-full bg-slate-100 px-4 py-2">
              Pi → Cloud: {formatMs(piCloudMs)}
            </span>
            <span className="rounded-full bg-slate-100 px-4 py-2">
              Browser → Cloud: {formatMs(browserCloudMs)}
            </span>
            <span className="rounded-full bg-slate-100 px-4 py-2">
              Move processing: {formatMs(moveMs)}
            </span>
            <span className="rounded-full bg-slate-100 px-4 py-2">
              {activeGame}
            </span>
            <span className="rounded-full bg-slate-100 px-4 py-2">
              {sideToMove} to move
            </span>
            <span className="rounded-full bg-slate-100 px-4 py-2">
              Detection: {detectionMode}
            </span>
            <span className="rounded-full bg-slate-100 px-4 py-2">
              Board: {boardLocked ? "LOCKED" : "NOT LOCKED"}
            </span>
            <span className="rounded-full bg-slate-100 px-4 py-2">
              AUTO: {autoEnabled ? "ON" : "OFF"}
            </span>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[1450px] w-full border-collapse text-left text-xs">
              <thead className="bg-[#813207] text-white">
                <tr>
                  {[
                    "No.",
                    "Time",
                    "Test Case",
                    "Source",
                    "Status",
                    "Pi → Cloud (ms)",
                    "Browser → Cloud (ms)",
                    "Move Processing (ms)",
                    "Estimated Total (ms)",
                    "Active Game",
                    "Side to Move",
                    "Notes",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-4 font-black">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-6 py-10 text-center text-slate-500">
                      Waiting for the first successful latency sample.
                    </td>
                  </tr>
                ) : (
                  [...records].reverse().map((record, reverseIndex) => (
                    <tr
                      key={record.id}
                      className={reverseIndex % 2 === 0 ? "bg-[#d9fbe8]" : "bg-[#effcf4]"}
                    >
                      <td className="px-4 py-4 font-black">
                        {records.length - reverseIndex}
                      </td>
                      <td className="px-4 py-4">{record.time}</td>
                      <td className="px-4 py-4 font-bold">{record.testCase}</td>
                      <td className="px-4 py-4">{record.source}</td>
                      <td className="px-4 py-4 font-black">
                        {record.status}
                      </td>
                      <td className="px-4 py-4">{record.piCloudMs ?? "—"}</td>
                      <td className="px-4 py-4">{record.browserCloudMs ?? "—"}</td>
                      <td className="px-4 py-4">{record.moveMs ?? "—"}</td>
                      <td className="px-4 py-4 font-black">
                        {record.totalMs === null ? "—" : Math.round(record.totalMs)}
                      </td>
                      <td className="px-4 py-4">{record.activeGame}</td>
                      <td className="px-4 py-4">{record.sideToMove}</td>
                      <td className="px-4 py-4 leading-5">{record.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Estimated total latency is the sum of the currently available
            components. Missing values are not invented. Records are stored only
            in this browser tab and can be exported as CSV.
          </p>
        </div>
      </section>

      <section
        ref={cameraWallRef}
        className="mx-auto max-w-[1750px] px-5 pb-14 sm:px-8"
      >
        <div className="rounded-[30px] border border-white/10 bg-[#0d172e] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-orange-300">
                Safe Camera Wall
              </p>
              <h2 className="mt-2 text-3xl font-black">
                YOLO and locked-board full views
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
                Maximum two MJPEG streams at one time. Streams stop automatically
                when this tab becomes hidden or you leave the page.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => startMode("yolo-board")}
                className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-black"
              >
                Start YOLO + Board
              </button>
              <button
                type="button"
                onClick={() => startMode("raw-board")}
                className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-black"
              >
                Start Raw + Board
              </button>
              <button
                type="button"
                onClick={() => setCameraMode("off")}
                className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-black text-rose-100"
              >
                Stop Cameras
              </button>
              <button
                type="button"
                onClick={enterCameraWall}
                className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-black"
              >
                Full Camera Wall
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <StreamPanel
              title={cameraMode === "raw-board" ? "Raw Camera" : "YOLO Detection"}
              subtitle={
                cameraMode === "raw-board"
                  ? "Original Raspberry Pi Camera Module V3 stream."
                  : "YOLO/overlay view. The fallback endpoint is used automatically."
              }
              sources={
                cameraMode === "raw-board" ? streams.raw : streams.yolo
              }
              active={cameraMode !== "off"}
              online={online && tunnelOnline}
            />

            <StreamPanel
              title="Locked Warped Board + Grid"
              subtitle="Perspective-corrected board used by move detection."
              sources={streams.board}
              active={cameraMode !== "off"}
              online={online && tunnelOnline}
            />
          </div>

          <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] px-5 py-4 text-sm leading-6 text-emerald-100">
            This page does not call Reset Pi Board, Sync Pi Moves, AUTO, manual
            detection or any move-submission endpoint. The dashboard controls
            remain separate and unaffected.
          </div>
        </div>
      </section>
    </main>
  );
}

