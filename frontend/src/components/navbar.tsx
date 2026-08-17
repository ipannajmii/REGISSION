"use client";
import { resolveAvatarUrl } from "@/lib/avatar-url";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  type AuthUser,
  getStoredToken,
  getStoredUser,
  logout,
  saveSession,
} from "@/lib/auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy/api";

const links = [
  { href: "/about", label: "About" },
  { href: "/features", label: "Features" },
  { href: "/dashboard", label: "Game Board", protected: true },
  { href: "/device", label: "Raspberry Pi", protected: true },
  { href: "/games", label: "History", protected: true },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(Date.now());

  async function refreshUser() {
    const storedUser = getStoredUser("user");
    const token = getStoredToken("user");

    setUser(storedUser);

    if (!storedUser || !token) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/profile`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        user: AuthUser;
      };

      saveSession(
        {
          token,
          user: payload.user,
        },
        true
      );

      setUser(payload.user);
      setAvatarVersion(Date.now());
    } catch {
      // Keep the stored user if the profile request is unavailable.
    }
  }

  useEffect(() => {
    void refreshUser();

    function handleStorage() {
      void refreshUser();
    }

    function handleAuthChange() {
      void refreshUser();
    }

    function closeOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      "regission-auth-change",
      handleAuthChange
    );
    document.addEventListener("mousedown", closeOutside);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "regission-auth-change",
        handleAuthChange
      );
      document.removeEventListener("mousedown", closeOutside);
    };
  }, [pathname]);

  function handleProtectedNavigation(
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) {
    if (user) return;

    event.preventDefault();
    router.push(`/login?next=${encodeURIComponent(href)}`);
  }

  async function handleLogout() {
    await logout("user");
    setUser(null);
    setMenuOpen(false);
    router.replace("/");
    router.refresh();
  }

  const initials = user?.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const resolvedAvatarUrl =
    resolveAvatarUrl(user);

  const avatarUrl = resolvedAvatarUrl
    ? `${resolvedAvatarUrl}${
        resolvedAvatarUrl.includes("?") ? "&" : "?"
      }v=${avatarVersion}`
    : null;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b1020]/80 backdrop-blur-xl">
      <div className="relative flex w-full items-center justify-between px-5 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="REGISSION"
            width={56}
            height={56}
            className="object-contain drop-shadow-[0_0_12px_rgba(249,115,22,0.5)]"
          />

          <div className="leading-tight">
            <div className="text-base font-extrabold tracking-wide text-white md:text-lg">
              REGISSION
            </div>

            <div className="text-[11px] text-white/55 md:text-xs">
              Vision {"\u2022"} Strategy {"\u2022"} IoT
            </div>
          </div>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-sm font-medium text-white/65 md:flex">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={(event) => {
                  if (link.protected) {
                    handleProtectedNavigation(event, link.href);
                  }
                }}
                className={
                  active
                    ? "text-orange-400"
                    : "transition hover:text-orange-400"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative" ref={menuRef}>
          {user ? (
            <>
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-4 text-left transition hover:bg-white/10"
              >
                <span className="relative flex h-9 w-9 overflow-hidden rounded-full bg-orange-500 text-xs font-black text-black">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={user.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      {initials || "U"}
                    </span>
                  )}
                </span>

                <span className="hidden sm:block">
                  <span className="block max-w-32 truncate text-xs font-bold text-white">
                    {user.name}
                  </span>
                  <span className="block text-[10px] text-emerald-300">
                    User online
                  </span>
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#101a2a] p-2 shadow-2xl">
                  <div className="border-b border-white/10 px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-11 w-11 shrink-0 overflow-hidden rounded-full bg-orange-500">
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={user.name}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-sm font-black text-black">
                            {initials || "U"}
                          </span>
                        )}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">
                          {user.name}
                        </p>
                        <p className="mt-1 truncate text-xs text-white/40">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="mt-2 block rounded-xl px-3 py-2.5 text-sm font-semibold text-white/75 transition hover:bg-white/5 hover:text-white"
                  >
                    Profile & Settings
                  </Link>

                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-3 py-2.5 text-sm text-white/65 transition hover:bg-white/5 hover:text-white"
                  >
                    Open Game Board
                  </Link>

                  <Link
                    href="/games"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-3 py-2.5 text-sm text-white/65 transition hover:bg-white/5 hover:text-white"
                  >
                    View Game History
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 w-full rounded-xl border border-red-400/15 bg-red-500/10 px-3 py-2.5 text-left text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10"
              >
                Sign in
              </Link>

              <Link
                href="/register"
                className="rounded-full bg-orange-500 px-4 py-2 text-xs font-bold text-black shadow-[0_10px_30px_rgba(249,115,22,0.3)] transition hover:bg-orange-400"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}