export type AvatarUser = {
  avatar_url?: string | null;
  avatar_path?: string | null;
};

export function resolveAvatarUrl(
  user: AvatarUser | null | undefined,
): string | null {
  const raw =
    user?.avatar_url?.trim() ||
    user?.avatar_path?.trim();

  if (!raw) {
    return null;
  }

  let value = raw.replace(/\\/g, "/");

  if (
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);

      value =
        parsed.pathname +
        parsed.search +
        parsed.hash;
    } catch {
      return null;
    }
  }

  if (value.startsWith("/api/")) {
    return value;
  }

  if (value.startsWith("api/")) {
    return `/${value}`;
  }

  const match = value.match(
    /^([^?#]*)([?#].*)?$/,
  );

  const pathname = match?.[1] ?? value;
  const suffix = match?.[2] ?? "";

  if (pathname.startsWith("/storage/")) {
    return `${pathname}${suffix}`;
  }

  let relative = pathname.replace(/^\/+/, "");

  relative = relative.replace(
    /^(?:(?:public|storage)\/)+/,
    "",
  );

  if (!relative) {
    return null;
  }

  if (relative.startsWith("avatars/")) {
    return `/storage/${relative}${suffix}`;
  }

  if (pathname.startsWith("/")) {
    return `${pathname}${suffix}`;
  }

  return `/storage/${relative}${suffix}`;
}
