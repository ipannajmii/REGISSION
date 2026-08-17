"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative z-20 mt-0 border-t border-white/10 bg-black/30">
      <div className="w-full px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-white">Regission</p>
            <p className="mt-1 text-sm text-white/60">
              © 2026 Regission. Demo website.
            </p>
          </div>

          <div className="flex flex-wrap gap-8 text-sm text-white/70">
            <Link className="hover:text-white" href="/about">
              About
            </Link>
            <Link className="hover:text-white" href="/features">
              Features
            </Link>
            <Link className="hover:text-white" href="/dashboard">
              Dashboard
            </Link>
            <Link className="hover:text-white" href="/games">
              History
            </Link>
            <Link className="hover:text-white" href="/contact">
              Contact
            </Link>
            <Link className="hover:text-white" href="/privacy">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}