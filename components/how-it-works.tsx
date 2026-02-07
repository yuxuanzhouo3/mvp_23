const steps = [
  {
    step: 1,
    title: "Describe",
    description:
      'Type your app idea. "Task manager with kanban", "AI content analyzer".',
  },
  {
    step: 2,
    title: "Generate",
    description:
      "Our AI assembles the full-stack code, architecture, and UI.",
  },
  {
    step: 3,
    title: "Deploy & Customize",
    description:
      "Your app is live. Edit the code directly in our online editor or clone the GitHub repo.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-slate-900/30">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
          Build Your MVP in 30 Seconds
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((item) => (
            <div key={item.step} className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center text-xl font-bold mb-4">
                {item.step}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {item.title}
              </h3>
              <p className="text-slate-400">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
