import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS_WITHOUT_BODY = new Set(["GET", "HEAD"]);

function backendBaseUrl(): string {
  return (process.env.BACKEND_URL || "http://127.0.0.1:8080")
    .replace(/\/+$/, "");
}

function backendPath(request: NextRequest): string {
  const prefix = "/api/proxy";
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith(prefix)) {
    throw new Error(`Unexpected proxy pathname: ${pathname}`);
  }

  const remainder = pathname.slice(prefix.length);
  return remainder.startsWith("/") ? remainder : `/${remainder}`;
}

async function requestBody(
  request: NextRequest,
  path: string,
): Promise<BodyInit | undefined> {
  if (METHODS_WITHOUT_BODY.has(request.method.toUpperCase())) {
    return undefined;
  }

  const contentType = request.headers.get("content-type") || "";

  // The normal login page historically omitted expected_role.
  // Add "user" only when it is missing. Admin login remains unchanged
  // because its explicit expected_role="admin" is preserved.
  if (
    path === "/api/auth/login" &&
    contentType.toLowerCase().includes("application/json")
  ) {
    const raw = await request.text();

    if (!raw.trim()) {
      return JSON.stringify({ expected_role: "user" });
    }

    try {
      const payload = JSON.parse(raw) as Record<string, unknown>;

      if (
        typeof payload.expected_role !== "string" ||
        !payload.expected_role.trim()
      ) {
        payload.expected_role = "user";
      }

      return JSON.stringify(payload);
    } catch {
      return raw;
    }
  }

  const bytes = await request.arrayBuffer();
  return bytes.byteLength > 0 ? bytes : undefined;
}

async function proxyRequest(request: NextRequest): Promise<Response> {
  try {
    const path = backendPath(request);
    const target = new URL(
      `${backendBaseUrl()}${path}${request.nextUrl.search}`,
    );

    const headers = new Headers(request.headers);

    for (const name of [
      "host",
      "connection",
      "content-length",
      "accept-encoding",
    ]) {
      headers.delete(name);
    }

    headers.set("accept", headers.get("accept") || "application/json");
    headers.set(
      "x-forwarded-host",
      request.headers.get("host") || request.nextUrl.host,
    );
    headers.set(
      "x-forwarded-proto",
      request.nextUrl.protocol.replace(":", ""),
    );

    const body = await requestBody(request, path);

    const backendResponse = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });

    const responseHeaders = new Headers(backendResponse.headers);

    for (const name of [
      "connection",
      "content-length",
      "content-encoding",
      "transfer-encoding",
    ]) {
      responseHeaders.delete(name);
    }

    responseHeaders.set("cache-control", "no-store");

    return new Response(await backendResponse.arrayBuffer(), {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown proxy error.";

    console.error("[REGISSION API PROXY ERROR]", error);

    return Response.json(
      {
        message: "REGISSION API proxy failed.",
        error: message,
      },
      { status: 502 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const HEAD = proxyRequest;
export const OPTIONS = proxyRequest;

