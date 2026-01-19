import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI 办公套件 - 智能办公新体验',
  description: '集成 AI 智能表格、PPT 设计、数据分析、深度报告的一站式办公平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
