import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SetGameBody = {
  game_id?: unknown;
  gameId?: unknown;
  id?: unknown;
};

function backendBase(): string {
  return (process.env.BACKEND_URL || "http://127.0.0.1:8080")
    .replace(/\/+$/, "");
}

function parseGameId(
  request: NextRequest,
  body: SetGameBody,
): number | null {
  const candidate =
    body.game_id ??
    body.gameId ??
    body.id ??
    request.nextUrl.searchParams.get("game_id") ??
    request.nextUrl.searchParams.get("gameId") ??
    request.nextUrl.searchParams.get("id");

  if (
    candidate === null ||
    candidate === undefined ||
    String(candidate).trim() === "" ||
    String(candidate).trim().toLowerCase() === "null"
  ) {
    return null;
  }

  const value = Number(candidate);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("game_id must be a positive integer or null.");
  }

  return value;
}

async function readBody(request: NextRequest): Promise<SetGameBody> {
  if (request.method === "GET" || request.method === "HEAD") {
    return {};
  }

  try {
    return (await request.json()) as SetGameBody;
  } catch {
    return {};
  }
}

function forwardedHeaders(request: NextRequest): Headers {
  const headers = new Headers();

  for (const name of [
    "authorization",
    "cookie",
    "accept",
    "user-agent",
  ]) {
    const value = request.headers.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  headers.set("accept", "application/json");
  headers.set("content-type", "application/json");

  return headers;
}

async function handle(request: NextRequest) {
  try {
    const body = await readBody(request);
    const gameId = parseGameId(request, body);

    const target =
      gameId === null
        ? `${backendBase()}/api/device/active-game`
        : `${backendBase()}/api/games/${gameId}/activate-device`;

    const method = gameId === null ? "DELETE" : "POST";

    const backendResponse = await fetch(target, {
      method,
      headers: forwardedHeaders(request),
      body: method === "POST" ? JSON.stringify({}) : undefined,
      redirect: "manual",
      cache: "no-store",
    });

    const contentType =
      backendResponse.headers.get("content-type") || "";

    const raw = await backendResponse.text();

    if (!backendResponse.ok) {
      return new NextResponse(raw || "Device assignment failed.", {
        status: backendResponse.status,
        headers: {
          "content-type":
            contentType || "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    let payload: Record<string, unknown> = {};

    if (raw.trim()) {
      try {
        payload = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        payload = { backend_response: raw };
      }
    }

    return NextResponse.json(
      {
        ...payload,
        ok: true,
        active_game_id: gameId,
        delivery: "Laravel heartbeat",
        message:
          gameId === null
            ? "Raspberry Pi assignment cleared. The Pi will receive this on its next heartbeat."
            : `Game ${gameId} assigned. The Raspberry Pi will receive it on its next heartbeat.`,
      },
      {
        status: backendResponse.status,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown device assignment error.";

    console.error("[REGISSION SET GAME ERROR]", error);

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 400 },
    );
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
