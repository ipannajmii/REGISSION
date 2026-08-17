import { NextRequest, NextResponse } from "next/server";

const RPI_BASE =
  process.env.RPI_BASE_URL ??
  process.env.RPI_BASE_URL ??
  "http://127.0.0.1:15051";

function buildTargetUrl(request: NextRequest, path: string[]): string {
  const target = new URL(
    `${RPI_BASE.replace(/\/$/, "")}/${path.join("/")}`
  );

  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  return target.toString();
}

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await context.params;
    const targetUrl = buildTargetUrl(request, path);

    const hasBody = !["GET", "HEAD"].includes(request.method);
    const body = hasBody ? await request.arrayBuffer() : undefined;

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        Accept: "application/json",
        ...(request.headers.get("content-type")
          ? { "Content-Type": request.headers.get("content-type") as string }
          : {}),
      },
      body,
      redirect: "manual",
      cache: "no-store",
    });

    const responseBody = await response.arrayBuffer();
    const responseHeaders = new Headers();
    const contentType = response.headers.get("content-type");

    if (contentType) {
      responseHeaders.set("content-type", contentType);
    }

    return new NextResponse(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reach Raspberry Pi";

    return NextResponse.json(
      { ok: false, message: `Raspberry Pi proxy error: ${message}` },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, context);
}
