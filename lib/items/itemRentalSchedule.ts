import { formatCurrency, formatDateShort } from '@/lib/utils/format'

export type ItemRentalScheduleEntry = {
  order_id: string
  order_number: string | null
  start_date: string
  end_date: string
  status: 'pending' | 'confirmed' | 'in_progress'
  /** 该资产在本订单中的行金额（租金） */
  amount: number | null
}

const STATUS_SORT_PRIORITY: Record<ItemRentalScheduleEntry['status'], number> = {
  in_progress: 0,
  confirmed: 1,
  pending: 2,
}

export function sortItemRentalSchedules(
  entries: ItemRentalScheduleEntry[]
): ItemRentalScheduleEntry[] {
  return [...entries].sort((a, b) => {
    const pa = STATUS_SORT_PRIORITY[a.status] ?? 9
    const pb = STATUS_SORT_PRIORITY[b.status] ?? 9
    if (pa !== pb) return pa - pb
    const start = a.start_date.localeCompare(b.start_date)
    if (start !== 0) return start
    return a.end_date.localeCompare(b.end_date)
  })
}

/** 展示用：同年省略年份，如 6/28–7/5 */
export function formatRentalPeriodShort(startDate: string, endDate: string): string {
  const start = startDate.split('T')[0]
  const end = endDate.split('T')[0]
  if (!start || !end) return '—'

  const [sy, sm, sd] = start.split('-')
  const [ey, em, ed] = end.split('-')
  if (sy && ey && sy === ey) {
    return `${Number(sm)}/${Number(sd)}–${Number(em)}/${Number(ed)}`
  }
  return `${formatDateShort(start)} – ${formatDateShort(end)}`
}

export function formatItemRentalScheduleTooltip(
  entries: ItemRentalScheduleEntry[] | undefined,
  maxLines = 4
): string | undefined {
  if (!entries?.length) return undefined

  const sorted = sortItemRentalSchedules(entries)
  const lines = sorted.slice(0, maxLines).map((entry) => {
    const range = formatRentalPeriodShort(entry.start_date, entry.end_date)
    const amountText =
      entry.amount != null && entry.amount > 0 ? ` · ${formatCurrency(entry.amount)}` : ''
    if (entry.status === 'in_progress') {
      return `租期 ${range}${amountText}（租期中）`
    }
    return `已订 ${range}${amountText}（待发货）`
  })

  if (sorted.length > maxLines) {
    lines.push(`另有 ${sorted.length - maxLines} 笔订单`)
  }

  return lines.join('\n')
}

export function formatItemRentalScheduleLine(entry: ItemRentalScheduleEntry): string {
  const range = formatRentalPeriodShort(entry.start_date, entry.end_date)
  const amountText =
    entry.amount != null && entry.amount > 0 ? ` · ${formatCurrency(entry.amount)}` : ''
  if (entry.status === 'in_progress') {
    return `租期 ${range}${amountText}（租期中）`
  }
  return `已订 ${range}${amountText}（待发货）`
}

export type ItemRentalSchedulesMap = Record<string, ItemRentalScheduleEntry[]>
