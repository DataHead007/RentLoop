/** 租赁订单列表：租后赔修统计（按交易记账日期） */

import { getDateRangeForPreset } from '@/lib/utils/format'

export const RENTAL_COMPENSATION_INCOME_CATEGORY = '赔偿收入'
export const RENTAL_MAINTENANCE_EXPENSE_CATEGORY = '维护费用'

/** 订单页日期筛选 → 租赁交易明细深链 */
export function buildRentalCompensationDetailHref(
  category: string,
  datePreset: 'all' | 'week' | 'month' | 'last_month' | 'next_month' | 'year'
): string {
  const params = new URLSearchParams()
  params.set('category', category)

  if (datePreset === 'all') {
    params.set('period', 'all')
  } else {
    const range = getDateRangeForPreset(datePreset)
    params.set('startDate', range.startDate)
    params.set('endDate', range.endDate)
    if (datePreset === 'month' || datePreset === 'last_month' || datePreset === 'next_month') {
      params.set('period', 'month')
      params.set('month', range.startDate.slice(0, 7))
    } else {
      params.set('period', 'range')
    }
  }

  return `/rental/transactions?${params.toString()}`
}

export type RentalCompensationStats = {
  compensationIncome: number
  maintenanceExpense: number
  incomeCount: number
  expenseCount: number
}

export function aggregateRentalCompensationStats(
  rows: { type: string; category: string | null; amount: number | string }[]
): RentalCompensationStats {
  let compensationIncome = 0
  let maintenanceExpense = 0
  let incomeCount = 0
  let expenseCount = 0

  for (const row of rows) {
    const category = row.category ?? ''
    const raw = parseFloat(String(row.amount)) || 0
    if (category === RENTAL_COMPENSATION_INCOME_CATEGORY && row.type === 'income') {
      compensationIncome += Math.abs(raw)
      incomeCount += 1
    } else if (category === RENTAL_MAINTENANCE_EXPENSE_CATEGORY && row.type === 'expense') {
      maintenanceExpense += Math.abs(raw)
      expenseCount += 1
    }
  }

  compensationIncome = Math.round(compensationIncome * 100) / 100
  maintenanceExpense = Math.round(maintenanceExpense * 100) / 100

  return {
    compensationIncome,
    maintenanceExpense,
    incomeCount,
    expenseCount,
  }
}

export function getDatePresetLabel(preset: string): string {
  switch (preset) {
    case 'week':
      return '本周'
    case 'month':
      return '本月'
    case 'last_month':
      return '上月'
    case 'next_month':
      return '下月'
    case 'year':
      return '本年'
    default:
      return '全部'
  }
}
