export default function AppDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-screen overflow-x-hidden bg-transparent">{children}</div>
}
