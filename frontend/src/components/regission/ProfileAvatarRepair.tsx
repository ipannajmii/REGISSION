"use client";

import { useEffect } from "react";

const REGISSION_PROFILE_AVATAR_REPAIR_V2 = true;
const REPAIR_ATTRIBUTE = "data-regission-avatar-repaired";

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isProfileImage(image: HTMLImageElement): boolean {
  let node: HTMLElement | null = image;

  for (let depth = 0; depth < 6; depth += 1) {
    if (!node || node === document.body) {
      break;
    }

    const text = normalize(node.textContent);
    const rect = node.getBoundingClientRect();

    if (
      (
        text.includes("user online") ||
        text.includes("admin online")
      ) &&
      rect.width <= 320 &&
      rect.height <= 130
    ) {
      return true;
    }

    node = node.parentElement;
  }

  const alt = normalize(image.alt);
  const source = normalize(
    image.getAttribute("src") ?? image.src,
  );

  return (
    alt.includes("profile") ||
    alt.includes("avatar") ||
    source.includes("avatar")
  );
}

function extractRelativePath(source: string): string | null {
  if (source === "" || source.startsWith("data:")) {
    return null;
  }

  let decoded = source;

  try {
    decoded = decodeURIComponent(source);
  } catch {
    decoded = source;
  }

  try {
    const parsed = new URL(decoded, window.location.origin);

    if (parsed.pathname === "/api/profile-avatar") {
      const existing =
        parsed.searchParams.get("path") ??
        parsed.searchParams.get("src");

      if (existing) {
        return extractRelativePath(existing);
      }
    }

    decoded = parsed.pathname;
  } catch {
    // Use the original source when URL parsing fails.
  }

  decoded = decoded
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^public\//i, "")
    .replace(/^storage\//i, "");

  const avatarIndex = decoded.toLowerCase().indexOf("avatars/");

  if (avatarIndex >= 0) {
    decoded = decoded.slice(avatarIndex);
  }

  if (
    decoded === "" ||
    decoded.includes("..") ||
    !/\.(png|jpe?g|webp|gif|svg)$/i.test(decoded)
  ) {
    return null;
  }

  return decoded;
}

function repairImage(image: HTMLImageElement): void {
  if (!isProfileImage(image)) {
    return;
  }

  const existing = image.getAttribute(REPAIR_ATTRIBUTE);

  if (existing === "done") {
    return;
  }

  const original =
    image.getAttribute("src") ??
    image.currentSrc ??
    image.src;

  const relative = extractRelativePath(original);

  if (!relative) {
    return;
  }

  image.setAttribute(REPAIR_ATTRIBUTE, "done");
  image.src =
    `/api/profile-avatar?path=${encodeURIComponent(relative)}`;

  image.style.display = "block";
  image.style.width = "100%";
  image.style.height = "100%";
  image.style.objectFit = "cover";
  image.style.borderRadius = "999px";
  image.style.background = "#ff6b00";
}

function scan(): void {
  const images = Array.from(
    document.querySelectorAll<HTMLImageElement>("img"),
  );

  for (const image of images) {
    if (!isProfileImage(image)) {
      continue;
    }

    image.addEventListener(
      "error",
      () => {
        repairImage(image);
      },
      { once: true },
    );

    if (image.complete && image.naturalWidth === 0) {
      repairImage(image);
    }
  }
}

export default function ProfileAvatarRepair() {
  useEffect(() => {
    scan();

    const observer = new MutationObserver(scan);

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });

    const timer = window.setInterval(scan, 1500);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
