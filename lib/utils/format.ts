// 格式化工具函数

import {
  differenceInDays,
  startOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from 'date-fns'

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * 将 Date 对象格式化为 YYYY-MM-DD 字符串（使用本地时间，避免时区问题）
 * @param date Date 对象
 * @returns YYYY-MM-DD 格式的字符串
 */
export function formatDateToLocalString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 距离开始日期还有多少天（发货日）
 * > 0 未开始，= 0 今天开始，< 0 已开始
 */
export function getDaysUntilStart(startDate: string | Date): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const today = startOfDay(new Date())
  const startDay = startOfDay(start)
  return differenceInDays(startDay, today)
}

/**
 * 距离结束日期还有多少天（归还日）
 * > 0 未到期，= 0 今天到期，< 0 已结束
 */
export function getDaysUntilEnd(endDate: string | Date): number {
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate
  const today = startOfDay(new Date())
  const endDay = startOfDay(end)
  return differenceInDays(endDay, today)
}

/**
 * 根据预设获取日期范围（周一为一周开始）
 * @param preset 预设：week=本周, month=本月, year=本年
 * @returns { startDate: YYYY-MM-DD, endDate: YYYY-MM-DD }
 */
export function getDateRangeForPreset(
  preset: 'week' | 'month' | 'year'
): { startDate: string; endDate: string } {
  const now = new Date()
  let start: Date
  let end: Date
  if (preset === 'week') {
    start = startOfWeek(now, { weekStartsOn: 1 })
    end = endOfWeek(now, { weekStartsOn: 1 })
  } else if (preset === 'month') {
    start = startOfMonth(now)
    end = endOfMonth(now)
  } else {
    start = startOfYear(now)
    end = endOfYear(now)
  }
  return {
    startDate: formatDateToLocalString(start),
    endDate: formatDateToLocalString(end),
  }
}
