import PageShell from "@/components/page-shell";

export default function FeaturesPage() {
  const features = [
    {
      title: "Vision Tracking",
      desc: "Uses camera-based move capture for over-the-board gameplay.",
    },
    {
      title: "Live Publishing",
      desc: "Sends detected moves directly to the dashboard in real time.",
    },
    {
      title: "Review Tools",
      desc: "Lets users inspect FEN, PGN, and move history from one place.",
    },
    {
      title: "Game History",
      desc: "Stores completed games and allows filtering by name and exact date.",
    },
    {
      title: "Manual Simulation",
      desc: "Allows SAN or UCI move input for testing without Raspberry Pi input.",
    },
    {
      title: "Export Support",
      desc: "Supports copying FEN and exporting PGN for later analysis.",
    },
  ];

  return (
    <PageShell>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-4xl font-black tracking-tight md:text-5xl">
          Features
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-white/70">
          Explore the key capabilities of Regission for physical-board chess
          tracking, publishing, and review.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {features.map((item) => (
            <div
              key={item.title}
              className="rounded-[28px] border border-white/10 bg-[#071121]/70 p-6 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
            >
              <h2 className="text-2xl font-black text-white">{item.title}</h2>
              <p className="mt-4 text-base leading-7 text-white/70">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}