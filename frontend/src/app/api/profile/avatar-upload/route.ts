import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LARAVEL_URL =
  "http://127.0.0.1:8080/api/profile/avatar";

const LARAVEL_METHOD: string = "POST";

export async function POST(request: NextRequest) {
  try {
    const incoming = await request.formData();
    const outgoing = new FormData();

    const candidate =
      incoming.get("avatar") ??
      incoming.get("photo") ??
      incoming.get("image") ??
      incoming.get("profile_photo");

    if (!(candidate instanceof Blob)) {
      return NextResponse.json(
        { message: "Choose a profile image first." },
        { status: 422 },
      );
    }

    const filename =
      candidate instanceof File && candidate.name
        ? candidate.name
        : "profile-image";

    outgoing.append("avatar", candidate, filename);
    outgoing.append("photo", candidate, filename);
    outgoing.append("image", candidate, filename);
    outgoing.append("profile_photo", candidate, filename);

    if (
      LARAVEL_METHOD === "PUT" ||
      LARAVEL_METHOD === "PATCH"
    ) {
      outgoing.append("_method", LARAVEL_METHOD);
    }

    const authorization = request.headers.get("authorization");
    const cookie = request.headers.get("cookie");
    const xsrfToken = request.headers.get("x-xsrf-token");

    const response = await fetch(LARAVEL_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(authorization
          ? { Authorization: authorization }
          : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(xsrfToken
          ? { "X-XSRF-TOKEN": xsrfToken }
          : {}),
      },
      body: outgoing,
      cache: "no-store",
    });

    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ??
          "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "The avatar upload proxy failed.",
        detail:
          error instanceof Error
            ? error.message
            : "Unknown upload error.",
      },
      { status: 500 },
    );
  }
}
