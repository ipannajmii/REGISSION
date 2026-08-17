"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HistoryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/games");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08111f] text-white">
      <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-7 text-center backdrop-blur-xl">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-orange-400" />
        <p className="mt-4 text-sm text-white/55">
          Opening your games...
        </p>
      </div>
    </main>
  );
}