import Link from "next/link";
import PageShell from "@/components/page-shell";

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#071121]/70 p-6 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.3)] md:p-8">
      <h2 className="text-2xl font-black text-white md:text-3xl">{title}</h2>
      <div className="mt-4 space-y-4 text-base leading-8 text-white/75">
        {children}
      </div>
    </section>
  );
}

function ValueCard({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0b1630]/70 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.24)]">
      <h3 className="text-xl font-black text-white">{title}</h3>
      <p className="mt-3 leading-7 text-white/70">{desc}</p>
    </div>
  );
}

function StatCard({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0b1630]/70 p-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.24)]">
      <div className="text-3xl font-black text-white md:text-4xl">{value}</div>
      <div className="mt-2 text-sm uppercase tracking-wide text-white/55">
        {label}
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 py-10">
        {/* Hero */}
        <div className="rounded-[30px] border border-white/10 bg-[#071121]/70 p-8 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.3)] md:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9aa5ff]">
            About Regission
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-6xl">
            Building a smarter way to
            <span className="block text-[#9aa5ff]">capture every move.</span>
          </h1>

          <p className="mt-6 max-w-4xl text-lg leading-9 text-white/75">
            Regission is a vision-powered chess notation platform designed for
            physical boards. Our goal is to connect over-the-board chess with a
            modern live dashboard so players, clubs, and organizers can track
            games more easily, review move history clearly, and preserve every
            important moment.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:translate-y-[1px]"
            >
              Open Dashboard
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10 active:translate-y-[1px]"
            >
              Contact Us
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <StatCard value="Vision" label="Camera-based move capture" />
          <StatCard value="Live" label="Real-time dashboard updates" />
          <StatCard value="Review" label="History, FEN and PGN tools" />
        </div>

        {/* Main sections */}
        <div className="mt-8 grid gap-6">
          <SectionCard title="Our Mission">
            <p>
              Regission exists to make physical chess easier to track, easier to
              review, and more enjoyable to manage in a digital environment.
              We want players to focus on the game while the system handles move
              recording, live updates, and post-game review.
            </p>
            <p>
              We are not just building a chess website. We are building a bridge
              between real boards and digital tools so that learning, analysis,
              and sharing become faster and more accessible.
            </p>
          </SectionCard>

          <SectionCard title="The Beginning">
            <p>
              Regission started from a simple problem: many physical chess games
              are still recorded manually, which can be slow, inconsistent, and
              difficult to manage during practice sessions or events.
            </p>
            <p>
              The idea behind the project was to create a system that watches the
              board, detects moves, validates them, and sends them directly to a
              web dashboard. Instead of separating physical play from digital
              records, Regission brings both together in one workflow.
            </p>
          </SectionCard>

          <SectionCard title="Regission Today">
            <p>
              Today, Regission is designed as a platform that combines computer
              vision, move validation, and a live web interface. The system is
              built to support ongoing games, move history, board review, and
              completed-game tracking in one place.
            </p>
            <p>
              The platform is especially useful for training sessions, club
              environments, demonstrations, and project-based deployments where
              users want a clearer way to capture and revisit over-the-board
              gameplay.
            </p>
          </SectionCard>
        </div>

        {/* Values */}
        <div className="mt-8 rounded-[30px] border border-white/10 bg-[#071121]/70 p-8 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.3)] md:p-10">
          <h2 className="text-3xl font-black text-white md:text-4xl">
            Our Values
          </h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/70">
            Regission is shaped by a few simple principles: clarity, learning,
            reliability, and enjoyment.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <ValueCard
              title="Clarity"
              desc="We want chess information to be easy to read, easy to review, and easy to trust."
            />
            <ValueCard
              title="Learning"
              desc="Every recorded move should help players improve through analysis and reflection."
            />
            <ValueCard
              title="Reliability"
              desc="A good chess system should not only look good, it should also record and display data consistently."
            />
            <ValueCard
              title="Enjoyment"
              desc="Chess should feel exciting and satisfying, both on the board and on the screen."
            />
          </div>
        </div>

        {/* Teams / System parts */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <SectionCard title="What Powers Regission">
            <p>
              Regission brings together several key elements into one platform:
            </p>
            <ul className="list-disc space-y-2 pl-6 text-white/75">
              <li>Camera-based board capture</li>
              <li>Move detection and change tracking</li>
              <li>Legality validation for move accuracy</li>
              <li>Live publishing to the web dashboard</li>
              <li>Move history and completed-game review</li>
              <li>Support for FEN and PGN export workflows</li>
            </ul>
          </SectionCard>

          <SectionCard title="Who Is It For">
            <p>
              Regission is built for players, student developers, clubs, and
              small-scale event organizers who want a practical way to connect
              physical chess gameplay with digital tracking tools.
            </p>
            <p>
              It is also suitable for demonstrations, academic projects, and
              experimental systems that combine IoT, computer vision, and web
              technologies.
            </p>
          </SectionCard>
        </div>

        {/* CTA */}
        <div className="mt-8 rounded-[30px] border border-white/10 bg-gradient-to-r from-[#071121]/80 via-[#101b3c]/80 to-[#071121]/80 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)] md:p-10">
          <h2 className="text-3xl font-black text-white md:text-4xl">
            Want to explore more?
          </h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/75">
            Discover the dashboard, browse completed games, or reach out for a
            demo and discussion about the project.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/features"
              className="inline-flex items-center justify-center rounded-xl bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:translate-y-[1px]"
            >
              Explore Features
            </Link>
            <Link
              href="/history"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10 active:translate-y-[1px]"
            >
              View History
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10 active:translate-y-[1px]"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}