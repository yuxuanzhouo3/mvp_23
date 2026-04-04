export default function StandaloneLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-screen bg-[#fcfbf7]">{children}</div>
}
