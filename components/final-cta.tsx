"use client";

import { useState } from "react";

export function FinalCTA() {
  const [input, setInput] = useState("");

  return (
    <section
      id="cta"
      className="py-24 px-6 bg-gradient-to-b from-slate-900/50 to-[var(--background)]"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Stop Configuring. Start Building.
        </h2>
        <p className="text-slate-400 mb-10">
          Your first full-stack app is one word away.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 p-2 rounded-xl border border-[var(--border)] bg-[var(--card)] focus-within:border-[var(--accent)] transition-colors">
          <input
            type="text"
            placeholder='Describe your app idea...'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-5 py-3 bg-transparent text-white placeholder:text-slate-500 outline-none"
          />
          <button className="px-6 py-3 rounded-lg bg-[var(--accent)] text-slate-900 font-semibold hover:bg-[var(--accent-hover)] transition-colors">
            Generate →
          </button>
        </div>
      </div>
    </section>
  );
}
