"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type AuthRole,
  type AuthUser,
  getStoredSession,
  validateSession,
} from "@/lib/auth";

type ProtectedRouteProps = {
  role: AuthRole;
  children: React.ReactNode;
};

export default function ProtectedRoute({
  role,
  children,
}: ProtectedRouteProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;

    async function check() {
      const stored = getStoredSession(role);

      if (!stored) {
        router.replace(role === "admin" ? "/admin/login" : "/login");
        return;
      }

      setUser(stored.user);

      try {
        const verified = await validateSession(role);

        if (!active) return;

        if (verified.role !== role) {
          router.replace(
            verified.role === "admin"
              ? "/admin/dashboard"
              : "/dashboard"
          );
          return;
        }

        setUser(verified);
        setReady(true);
      } catch {
        if (active) {
          router.replace(
            role === "admin" ? "/admin/login" : "/login"
          );
        }
      }
    }

    void check();

    return () => {
      active = false;
    };
  }, [role, router]);

  if (!ready || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08111f] text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-7 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-orange-400" />
          <p className="mt-4 text-sm text-white/60">
            Verifying your REGISSION session...
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}