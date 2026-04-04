import React from "react"
import type { Metadata, Viewport } from 'next'

import './globals.css'
import { Providers } from "@/components/providers"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mornscience.app"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'mornstack | 一句话生成全栈应用',
  description: '从提示词到官网、后台、文档与移动端交付的一站式 AI 全栈生成平台。',
  icons: {
    icon: '/logo.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#07111f',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
