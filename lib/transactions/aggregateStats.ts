const NON_OPERATING_INCOME_CATEGORIES = new Set(['融资放款入账'])
const NON_OPERATING_EXPENSE_CATEGORIES = new Set(['归还借款本金'])

export type TransactionSummaryRow = {
  business_plate: string | null
  creator_channel: string | null
  type: string
  category: string
  total_amount: number
  tx_count: number
}

export type TransactionStatsPayload = {
  totalIncome: number
  totalExpense: number
  netProfit: number
  operatingIncome: number
  operatingExpense: number
  cashNetFlow: number
  transactionCount: number
  incomeByCategory: { category: string; amount: number }[]
  expenseByCategory: { category: string; amount: number }[]
}

export type ScopeBreakdownRow = {
  /** 经营口径收入（不含融资放款入账） */
  operatingIncome: number
  /** 经营口径支出（不含归还借款本金） */
  operatingExpense: number
  /** 经营净利 = operatingIncome - operatingExpense */
  net: number
  /** 现金流收入（含融资放款等） */
  cashIncome: number
  /** 现金流支出 */
  cashExpense: number
}

export type ScopeBreakdownKey =
  | 'rental'
  | 'badminton'
  | 'creator:youtube'
  | 'creator:wechat_video'
  | 'creator:xiaohongshu'

function rowAmount(type: string, amount: number): number {
  const n = Number(amount) || 0
  return type === 'expense' ? Math.abs(n) : n
}

function scopeKeyFromRow(row: TransactionSummaryRow): ScopeBreakdownKey | null {
  const plate = row.business_plate
  if (plate === 'rental') return 'rental'
  if (plate === 'badminton') return 'badminton'
  if (plate === 'creator') {
    const ch = row.creator_channel
    if (ch === 'youtube') return 'creator:youtube'
    if (ch === 'wechat_video') return 'creator:wechat_video'
    if (ch === 'xiaohongshu') return 'creator:xiaohongshu'
  }
  return null
}

export function aggregateTransactionSummaryRows(
  summaryRows: TransactionSummaryRow[]
): TransactionStatsPayload {
  let totalIncome = 0
  let totalExpense = 0
  let operatingIncome = 0
  let operatingExpense = 0
  let transactionCount = 0

  const incomeByCategory: Record<string, number> = {}
  const expenseByCategory: Record<string, number> = {}

  for (const row of summaryRows) {
    const amount = rowAmount(row.type, row.total_amount)
    const count = Number(row.tx_count) || 0
    const rowCategory = row.category || '其他'
    transactionCount += count

    if (row.type === 'income') {
      totalIncome += amount
      incomeByCategory[rowCategory] = (incomeByCategory[rowCategory] || 0) + amount
      if (!NON_OPERATING_INCOME_CATEGORIES.has(rowCategory)) {
        operatingIncome += amount
      }
    } else if (row.type === 'expense') {
      totalExpense += amount
      expenseByCategory[rowCategory] = (expenseByCategory[rowCategory] || 0) + amount
      if (!NON_OPERATING_EXPENSE_CATEGORIES.has(rowCategory)) {
        operatingExpense += amount
      }
    }
  }

  return {
    totalIncome,
    totalExpense,
    netProfit: operatingIncome - operatingExpense,
    operatingIncome,
    operatingExpense,
    cashNetFlow: totalIncome - totalExpense,
    transactionCount,
    incomeByCategory: Object.entries(incomeByCategory).map(([category, amount]) => ({
      category,
      amount,
    })),
    expenseByCategory: Object.entries(expenseByCategory).map(([category, amount]) => ({
      category,
      amount,
    })),
  }
}

export function aggregateScopeBreakdown(
  summaryRows: TransactionSummaryRow[]
): Partial<Record<ScopeBreakdownKey, ScopeBreakdownRow>> {
  const buckets: Partial<
    Record<ScopeBreakdownKey, { income: number; expense: number; operatingIncome: number; operatingExpense: number }>
  > = {}

  for (const row of summaryRows) {
    const key = scopeKeyFromRow(row)
    if (!key) continue

    const amount = rowAmount(row.type, row.total_amount)
    const rowCategory = row.category || '其他'
    const bucket = buckets[key] ?? {
      income: 0,
      expense: 0,
      operatingIncome: 0,
      operatingExpense: 0,
    }

    if (row.type === 'income') {
      bucket.income += amount
      if (!NON_OPERATING_INCOME_CATEGORIES.has(rowCategory)) {
        bucket.operatingIncome += amount
      }
    } else if (row.type === 'expense') {
      bucket.expense += amount
      if (!NON_OPERATING_EXPENSE_CATEGORIES.has(rowCategory)) {
        bucket.operatingExpense += amount
      }
    }
    buckets[key] = bucket
  }

  const out: Partial<Record<ScopeBreakdownKey, ScopeBreakdownRow>> = {}
  for (const [key, b] of Object.entries(buckets) as [
    ScopeBreakdownKey,
    { income: number; expense: number; operatingIncome: number; operatingExpense: number },
  ][]) {
    out[key] = {
      operatingIncome: b.operatingIncome,
      operatingExpense: b.operatingExpense,
      net: b.operatingIncome - b.operatingExpense,
      cashIncome: b.income,
      cashExpense: b.expense,
    }
  }
  return out
}

type RawTransactionRow = {
  business_plate: string | null
  creator_channel: string | null
  type: string
  category: string | null
  amount: number | string
}

/** RPC 不可用时的兜底：拉明细后在应用层聚合 */
export function buildSummaryRowsFromTransactions(rows: RawTransactionRow[]): TransactionSummaryRow[] {
  const map = new Map<
    string,
    { business_plate: string | null; creator_channel: string | null; type: string; category: string; total_amount: number; tx_count: number }
  >()

  for (const tx of rows) {
    const type = tx.type
    const category = tx.category || '其他'
    const key = `${tx.business_plate ?? ''}|${tx.creator_channel ?? ''}|${type}|${category}`
    const amount = rowAmount(type, Number(tx.amount) || 0)
    const existing = map.get(key)
    if (existing) {
      existing.total_amount += amount
      existing.tx_count += 1
    } else {
      map.set(key, {
        business_plate: tx.business_plate,
        creator_channel: tx.creator_channel,
        type,
        category,
        total_amount: amount,
        tx_count: 1,
      })
    }
  }

  return Array.from(map.values())
}

export function dbErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'object' && error !== null) {
    const e = error as { message?: unknown; details?: unknown; hint?: unknown }
    const parts = [e.message, e.details, e.hint]
      .filter((p) => typeof p === 'string' && p.trim())
      .map(String)
    if (parts.length > 0) return parts.join(' · ')
  }
  return 'Failed to fetch transaction stats'
}
