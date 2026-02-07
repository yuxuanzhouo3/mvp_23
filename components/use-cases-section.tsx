const useCases = [
  '"Instagram for pet owners"',
  '"Internal team dashboard"',
  '"API analytics platform"',
  '"Customer feedback widget"',
];

export function UseCasesSection() {
  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
          What Our Community is Building
        </h2>
        <div className="flex flex-wrap justify-center gap-4">
          {useCases.map((prompt) => (
            <div
              key={prompt}
              className="px-6 py-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-slate-300 hover:border-[var(--accent)]/50 transition-colors"
            >
              {prompt}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
