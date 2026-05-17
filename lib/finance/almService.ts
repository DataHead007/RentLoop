import { supabaseServer } from '@/lib/supabase/server'
import {
  globalWalletContribution,
  GLOBAL_WALLET_EXCLUDED_INCOME,
  type WalletRow,
} from '@/lib/finance/almConstants'

const PAGE_SIZE = 1000

export type RentalWalletExcludedRow = {
  id: string
  transaction_date: string
  type: 'income' | 'expense'
  category: string | null
  amount: number
  description: string | null
  item_id: string | null
  order_id: string | null
  excludeReason: 'empty_category' | 'category_not_whitelisted'
}

export type RentalWalletExclusionReport = {
  count: number
  /** 按类目（含「(无类目)」）聚合 */
  byCategory: { category: string; count: number; signedTotal: number }[]
  rows: RentalWalletExcludedRow[]
}

async function fetchAllRentalTransactionsForReport(): Promise<
  Array<{
    id: string
    amount: unknown
    type: 'income' | 'expense'
    category: string | null
    description: string | null
    transaction_date: string
    item_id: string | null
    order_id: string | null
  }>
> {
  const rows: Array<{
    id: string
    amount: unknown
    type: 'income' | 'expense'
    category: string | null
    description: string | null
    transaction_date: string
    item_id: string | null
    order_id: string | null
  }> = []
  let from = 0
  for (;;) {
    const { data, error } = await supabaseServer
      .from('transactions')
      .select('id, amount, type, category, description, transaction_date, item_id, order_id')
      .eq('business_plate', 'rental')
      .order('transaction_date', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    const batch = data || []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function fetchAllWalletRows(): Promise<WalletRow[]> {
  const rows: WalletRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabaseServer
      .from('transactions')
      .select('amount,type,category')
      .eq('business_plate', 'rental')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    const batch = data || []
    rows.push(...(batch as WalletRow[]))
    if (batch.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

export type AlmGlobalSummary = {
  /** 本摘要仅含租赁业务线流水；其他事业部单独核算 */
  businessLineScope: 'rental'
  globalBalance: number
  computedAt: string
  includedTransactionCount: number
  excludedTransactionCount: number
  activeFinancingCount: number
  totalPrincipalRemaining: number
  suggestRepayment: boolean
  suggestRepaymentMinBalance: number
  policy: {
    note: string
    excludedIncomeCategories: readonly string[]
  }
}

/**
 * 只读：全局可用资金 + 是否存在进行中融资（用于还款提示）。
 */
export async function getAlmGlobalSummary(): Promise<AlmGlobalSummary> {
  const [txRows, loansRes] = await Promise.all([
    fetchAllWalletRows(),
    supabaseServer
      .from('financing_loans')
      .select('id, principal_remaining, status')
      .eq('status', 'active'),
  ])

  if (loansRes.error) throw loansRes.error

  let globalBalance = 0
  let includedTransactionCount = 0
  let excludedTransactionCount = 0

  for (const row of txRows) {
    const c = globalWalletContribution(row)
    if (c === null) {
      excludedTransactionCount += 1
    } else {
      globalBalance += c
      includedTransactionCount += 1
    }
  }

  const activeLoans = (loansRes.data || []) as { principal_remaining: number }[]
  const totalPrincipalRemaining = activeLoans.reduce(
    (s, l) => s + (parseFloat(String(l.principal_remaining ?? 0)) || 0),
    0
  )

  const suggestRepaymentMinBalance = Math.max(
    0,
    Number.parseFloat(process.env.ALM_REPAYMENT_HINT_MIN_BALANCE || '1000') || 1000
  )

  const suggestRepayment =
    globalBalance >= suggestRepaymentMinBalance - 1e-9 && totalPrincipalRemaining > 1e-9

  return {
    businessLineScope: 'rental',
    globalBalance: Math.round(globalBalance * 100) / 100,
    computedAt: new Date().toISOString(),
    includedTransactionCount,
    excludedTransactionCount,
    activeFinancingCount: activeLoans.length,
    totalPrincipalRemaining: Math.round(totalPrincipalRemaining * 100) / 100,
    suggestRepayment,
    suggestRepaymentMinBalance,
    policy: {
      note: '仅统计业务线为「租赁」且类目在白名单内的流水；羽毛球/自媒体等为独立事业部，不参与本池。押金收入不计入；无类目流水不计入。',
      excludedIncomeCategories: GLOBAL_WALLET_EXCLUDED_INCOME,
    },
  }
}

/**
 * 租赁业务线中未计入「租赁 · 全局可用资金」的流水（无类目或类目不在白名单）。
 */
export async function getRentalGlobalWalletExclusionReport(): Promise<RentalWalletExclusionReport> {
  const raw = await fetchAllRentalTransactionsForReport()
  const excluded: RentalWalletExcludedRow[] = []

  const catKey = (c: string | null) => (c?.trim() ? c.trim() : '(无类目)')
  const byCat = new Map<string, { count: number; signedTotal: number }>()

  for (const r of raw) {
    const walletRow: WalletRow = { type: r.type, category: r.category, amount: r.amount }
    if (globalWalletContribution(walletRow) !== null) continue

    const amt = parseFloat(String(r.amount ?? '0')) || 0
    const reason: RentalWalletExcludedRow['excludeReason'] =
      !r.category?.trim() ? 'empty_category' : 'category_not_whitelisted'

    excluded.push({
      id: r.id,
      transaction_date: r.transaction_date,
      type: r.type,
      category: r.category,
      amount: Math.round(amt * 100) / 100,
      description: r.description,
      item_id: r.item_id,
      order_id: r.order_id,
      excludeReason: reason,
    })

    const key = catKey(r.category)
    const prev = byCat.get(key) || { count: 0, signedTotal: 0 }
    prev.count += 1
    prev.signedTotal += amt
    byCat.set(key, prev)
  }

  const byCategory = [...byCat.entries()]
    .map(([category, v]) => ({
      category,
      count: v.count,
      signedTotal: Math.round(v.signedTotal * 100) / 100,
    }))
    .sort((a, b) => Math.abs(b.signedTotal) - Math.abs(a.signedTotal) || b.count - a.count)

  return {
    count: excluded.length,
    byCategory,
    rows: excluded,
  }
}
