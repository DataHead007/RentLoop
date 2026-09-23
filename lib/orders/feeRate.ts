/** 默认支付手续费率：固定 1.6%（不再按本月单量自动切换） */
export const DEFAULT_FEE_RATE = 0.016

export function resolveFeeRate(feeRate: number | null | undefined): number {
  if (feeRate === null || feeRate === undefined) return DEFAULT_FEE_RATE
  return feeRate
}

export function calculateNetAmountFromSubtotal(
  subtotal: number,
  feeRate: number | null | undefined
): number {
  const rate = resolveFeeRate(feeRate)
  return Math.round(subtotal * (1 - rate) * 100) / 100
}
