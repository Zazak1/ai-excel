// 用户相关类型
export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  plan: 'free' | 'pro' | 'enterprise'
  aiQuotaUsed: number
  aiQuotaTotal: number
}

// 项目相关类型
export interface Project {
  id: string
  name: string
  type: 'spreadsheet' | 'presentation' | 'analytics' | 'report'
  status: 'draft' | 'processing' | 'ready'
  updatedAt: string
  createdAt: string
}

// AI 智能表格类型
export interface SpreadsheetCell {
  id: string
  row: number
  col: number
  value: string | number | null
  formula?: string
  format?: CellFormat
  aiInsight?: AIInsight
}

export interface CellFormat {
  bold?: boolean
  italic?: boolean
  color?: string
  backgroundColor?: string
  align?: 'left' | 'center' | 'right'
}

export interface AIInsight {
  type: 'anomaly' | 'trend' | 'suggestion'
  message: string
  confidence: number
  suggestedValue?: string | number
}

// PPT 相关类型
export interface Slide {
  id: string
  order: number
  title: string
  content: SlideContent
  thumbnail?: string
  layout: SlideLayout
}

export interface SlideContent {
  title?: string
  subtitle?: string
  body?: string
  images?: SlideImage[]
  charts?: SlideChart[]
  stats?: SlideStat[]
}

export interface SlideImage {
  id: string
  url: string
  alt: string
  position: { x: number; y: number }
  size: { width: number; height: number }
}

export interface SlideChart {
  id: string
  type: 'bar' | 'line' | 'pie' | 'donut'
  data: Record<string, unknown>
}

export interface SlideStat {
  label: string
  value: string
  description?: string
}

export type SlideLayout = 'title' | 'content' | 'two-column' | 'image-left' | 'image-right' | 'stats'

// 数据分析类型
export interface DataSource {
  id: string
  name: string
  type: 'mysql' | 'csv' | 'api' | 'excel'
  status: 'connected' | 'disconnected' | 'error'
  lastSync?: string
}

export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    color?: string
  }[]
}

export interface AnalyticsInsight {
  id: string
  type: 'anomaly' | 'prediction' | 'correlation'
  title: string
  description: string
  confidence: number
  sources: string[]
}

// 深度报告类型
export interface Document {
  id: string
  name: string
  type: 'pdf' | 'xlsx' | 'docx' | 'csv'
  size: number
  uploadedAt: string
  tags: string[]
  selected: boolean
}

export interface ReportSection {
  id: string
  type: 'heading' | 'paragraph' | 'chart' | 'quote' | 'summary'
  content: string
  citations?: Citation[]
}

export interface Citation {
  id: string
  sourceDocId: string
  sourceName: string
  pageOrCell: string
  text: string
}

// 导航相关
export interface NavItem {
  id: string
  label: string
  icon: string
  href: string
  badge?: string
}
