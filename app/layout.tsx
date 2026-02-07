import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "mornFullStack | One Word to a Full-Stack App",
  description:
    "Describe your idea. Instantly generate a complete, deployable MVP. No code, no configuration, just your vision.",
  keywords: ["full-stack", "MVP", "no-code", "React", "Node.js", "PostgreSQL"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
