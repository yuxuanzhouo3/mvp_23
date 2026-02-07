const features = [
  {
    title: "Modern Frontend",
    description:
      "A responsive React/Next.js UI with Tailwind CSS. Clean, fast, and customizable.",
    icon: "◈",
  },
  {
    title: "Production Backend",
    description:
      "A secure Node.js API with Express.js. Pre-built routes, middleware, and business logic.",
    icon: "◉",
  },
  {
    title: "Managed Database",
    description:
      "A live PostgreSQL database with an auto-generated schema based on your prompt.",
    icon: "◇",
  },
  {
    title: "One-Click Deploy",
    description:
      "Deploy your generated app to Vercel/Netlify and Railway with a single click. Real, shareable URLs.",
    icon: "▸",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
          What You Instantly Get
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 hover:border-[var(--accent)]/50 transition-colors"
            >
              <div className="text-2xl text-[var(--accent)] mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
