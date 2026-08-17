import React from "react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0b1220] text-white">
      {/* ONE background only */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[#0b1220]" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:radial-gradient(rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="absolute -top-40 left-1/3 h-[520px] w-[520px] rounded-full bg-[#5865F2]/18 blur-3xl" />
        <div className="absolute top-20 -right-40 h-[420px] w-[420px] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-56 left-10 h-[520px] w-[520px] rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    </main>
  );
}