import Link from "next/link";

const footerLinks = [
  { href: "#", label: "Twitter" },
  { href: "#", label: "GitHub" },
  { href: "#", label: "Discord" },
  { href: "#", label: "Terms" },
  { href: "#", label: "Privacy" },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] py-12 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-slate-500 text-sm">
            © 2025 mornFullStack MVP. From idea to deployed app.
          </p>
          <div className="flex items-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-slate-500 hover:text-[var(--accent)] text-sm transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <p className="text-slate-600 text-xs">
            mornhub.app → mornFullStack mvp_23
          </p>
        </div>
        <div className="mt-6 flex justify-center">
          <span className="text-slate-600 text-xs">
            Next.js | React | Node.js | PostgreSQL | Tailwind | Vercel
          </span>
        </div>
      </div>
    </footer>
  );
}
