import {
  addMonths,
  endOfMonth,
  format,
  getDaysInMonth,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { formatDateToLocalString } from '@/lib/utils/format'

export type TransactionPeriodMode = 'month' | 'all'

export type MonthRange = {
  startDate: string
  endDate: string
}

/** 自然月起止（本地日历，YYYY-MM-DD） */
export function getMonthRange(month: Date): MonthRange {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  return {
    startDate: formatDateToLocalString(start),
    endDate: formatDateToLocalString(end),
  }
}

export function formatMonthLabel(month: Date): string {
  return format(month, 'yyyy年M月')
}

export function parseMonthParam(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null
  const [y, m] = value.split('-').map(Number)
  if (m < 1 || m > 12) return null
  return startOfMonth(new Date(y, m - 1, 1))
}

export function monthToParam(month: Date): string {
  return format(month, 'yyyy-MM')
}

export function shiftMonth(month: Date, delta: number): Date {
  return startOfMonth(addMonths(month, delta))
}

export function getCurrentMonthStart(): Date {
  return startOfMonth(new Date())
}

export function getPreviousMonthStart(month: Date): Date {
  return startOfMonth(subMonths(month, 1))
}

/** 本月进度文案，非本月返回 null */
export function formatMonthProgressHint(month: Date, reference = new Date()): string | null {
  const current = startOfMonth(reference)
  if (month.getTime() !== current.getTime()) return null
  const day = reference.getDate()
  const total = getDaysInMonth(reference)
  return `本月已过 ${day}/${total} 天`
}

export function appendPeriodToSearchParams(
  params: URLSearchParams,
  periodMode: TransactionPeriodMode,
  viewMonth: Date
): URLSearchParams {
  if (periodMode === 'all') return params
  const { startDate, endDate } = getMonthRange(viewMonth)
  params.set('startDate', startDate)
  params.set('endDate', endDate)
  return params
}

export function periodLabel(periodMode: TransactionPeriodMode, viewMonth: Date): string {
  return periodMode === 'all' ? '全部累计' : formatMonthLabel(viewMonth)
}
