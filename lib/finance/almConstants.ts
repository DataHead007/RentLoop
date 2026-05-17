/**
 * 租赁事业部 · 全局可用资金（ALM 记法 A）——类目白名单
 *
 * 羽毛球 / 自媒体等为**单独核算**的其他板块，不参与本池（见 `almService` 中按 `business_plate = rental` 过滤）。
 *
 * - 仅统计「类目明确命中」的流水；无类目或未知类目不计入。
 * - 收入侧排除「押金收入」：多为负债口径，不视为可支配现金。
 * - 负债减少仅认「归还借款本金」+ 融资表；租金不冲贷。
 */
const RENTAL_GLOBAL_WALLET_INCOME = [
  '租金收入',
  '配件出售收入',
  '赔偿收入',
  '融资放款入账',
  '设备出售',
  '其他收入',
] as const

const RENTAL_GLOBAL_WALLET_EXPENSE = [
  '设备购买',
  '维护费用',
  /** 交易表单里手动选的物流类支出 */
  '物流费用',
  /** 订单结算时由系统写入（与 shipping_fees / 订单物流一致），见 `app/api/orders/[id]/route.ts` */
  '物流支出',
  /** 第三方游戏/账号等转租成本，订单结算时系统写入 */
  '转租支出',
  '融资成本',
  '归还借款本金',
  '其他支出',
] as const

export const RENTAL_ALM_INCOME_WHITELIST = [...RENTAL_GLOBAL_WALLET_INCOME] as readonly string[]
export const RENTAL_ALM_EXPENSE_WHITELIST = [...RENTAL_GLOBAL_WALLET_EXPENSE] as readonly string[]

export const GLOBAL_WALLET_INCOME_CATEGORIES = new Set<string>([...RENTAL_GLOBAL_WALLET_INCOME])

export const GLOBAL_WALLET_EXPENSE_CATEGORIES = new Set<string>([...RENTAL_GLOBAL_WALLET_EXPENSE])

/** 明确从全局池排除的租赁收入类目（文档 / API 说明用） */
export const GLOBAL_WALLET_EXCLUDED_INCOME = ['押金收入'] as const

export function parseTransactionAmount(raw: unknown): number {
  const n = parseFloat(String(raw ?? '0'))
  return Number.isFinite(n) ? n : 0
}

export type WalletRow = {
  type: 'income' | 'expense'
  category: string | null
  amount: unknown
}

/**
 * 该笔流水对「全局可用资金」的带符号贡献；不参与白名单则返回 null。
 * 支出在库中一般为负数，直接相加即可。
 */
export function globalWalletContribution(row: WalletRow): number | null {
  const cat = row.category || ''
  const amt = parseTransactionAmount(row.amount)
  if (row.type === 'income') {
    if (!GLOBAL_WALLET_INCOME_CATEGORIES.has(cat)) return null
    return amt
  }
  if (row.type === 'expense') {
    if (!GLOBAL_WALLET_EXPENSE_CATEGORIES.has(cat)) return null
    return amt
  }
  return null
}
