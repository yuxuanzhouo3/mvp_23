import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'

import './globals.css'
import { Providers } from "@/components/providers"

const _inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const _jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mornstack.vercel.app"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'mornstack | 一句话生成全栈应用',
  description: '从提示词到官网、后台、文档与移动端交付的一站式 AI 全栈生成平台。',
  icons: {
    icon: '/logo.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
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
