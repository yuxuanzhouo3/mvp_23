"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const terminalLines = [
  { text: '$ mornfullstack generate "social network for book clubs"', delay: 0 },
  { text: "⚡ Generating your full-stack MVP...", delay: 600 },
  { text: "✅ Frontend (React/Next.js): ...Ready", delay: 1200 },
  { text: "✅ Backend (Node.js/API): ...Ready", delay: 1800 },
  { text: "✅ Database (PostgreSQL/Schema): ...Ready", delay: 2400 },
  { text: "✅ Authentication: ...Ready", delay: 3000 },
  {
    text: "🔗 Your app is live at: https://bookclub-mvp.mornfullstack.app",
    delay: 3600,
  },
];

export function HeroSection() {
  const [visibleLines, setVisibleLines] = useState<number>(0);

  useEffect(() => {
    const timers = terminalLines.map((_, i) =>
      setTimeout(() => setVisibleLines((v) => v + 1), terminalLines[i].delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <section className="relative pt-32 pb-24 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-4">
            From One Word to a Full-Stack App.
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            Describe your idea. Instantly generate a complete, deployable MVP. No
            code, no configuration, just your vision.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="#cta"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-lg bg-[var(--accent)] text-slate-900 font-semibold hover:bg-[var(--accent-hover)] transition-colors shadow-lg shadow-cyan-500/25"
            >
              Generate Your App Now
            </Link>
            <Link
              href="#"
              className="text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              Watch a 60-second demo →
            </Link>
          </div>
        </div>

        <div className="relative rounded-xl border border-[var(--border)] bg-slate-900/80 p-6 md:p-8 font-mono text-sm overflow-hidden shadow-2xl">
          <div className="absolute top-3 left-4 flex gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="pt-8 space-y-2">
            {terminalLines.slice(0, visibleLines).map((line, i) => (
              <div
                key={i}
                className="terminal-line text-slate-300"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {line.text}
              </div>
            ))}
            {visibleLines > 0 && visibleLines < terminalLines.length && (
              <span className="cursor-blink inline-block w-2 h-4 ml-1 bg-[var(--accent)]" />
            )}
            {visibleLines === terminalLines.length && (
              <span className="cursor-blink inline-block w-2 h-4 ml-1 bg-[var(--accent)]" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
