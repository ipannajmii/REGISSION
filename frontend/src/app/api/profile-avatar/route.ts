import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROOTS = [
  "/var/www/regission-server/storage/app/public",
  "/var/www/regission-server/public/storage",
];

function sanitize(value: string): string | null {
  let decoded = value;

  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }

  decoded = decoded
    .replace(/\\/g, "/")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/^public\//i, "")
    .replace(/^storage\//i, "");

  const avatarIndex = decoded.toLowerCase().indexOf("avatars/");

  if (avatarIndex >= 0) {
    decoded = decoded.slice(avatarIndex);
  }

  if (
    decoded === "" ||
    decoded.includes("\0") ||
    decoded.split("/").includes("..")
  ) {
    return null;
  }

  return decoded;
}

function mime(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

export async function GET(request: NextRequest) {
  const source =
    request.nextUrl.searchParams.get("path") ??
    request.nextUrl.searchParams.get("src") ??
    "";

  const relative = sanitize(source);

  if (!relative) {
    return NextResponse.json(
      { message: "Invalid avatar path." },
      { status: 400 },
    );
  }

  for (const root of ROOTS) {
    const rootPath = path.resolve(root);
    const filePath = path.resolve(rootPath, relative);

    if (
      filePath !== rootPath &&
      !filePath.startsWith(`${rootPath}${path.sep}`)
    ) {
      continue;
    }

    try {
      const file = await readFile(filePath);

      return new NextResponse(file, {
        status: 200,
        headers: {
          "Content-Type": mime(filePath),
          "Cache-Control": "private, max-age=300",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // Try the next Laravel storage root.
    }
  }

  return NextResponse.json(
    {
      message: "Avatar file not found.",
      path: relative,
    },
    { status: 404 },
  );
}
