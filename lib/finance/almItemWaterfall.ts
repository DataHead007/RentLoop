/**
 * 单资产 ALM 三色条（记法 A）
 * - 红：进行中融资剩余本金 L（来自 financing_loans，不由租金冲减）。
 * - 黄：购置尚未被「经营累计净额」覆盖的部分中，扣除与红重叠后的自有侧缺口展示：max(0, gap − min(L, gap))，gap = payback_remaining。
 * - 绿：经营已超过有效购置价的盈余（payback_excess），条内最多占满剩余宽度，超出为「溢出」比例单独展示。
 */

export type AlmStackSegmentKey = 'debt' | 'own' | 'profit'

export type AlmStackSegment = {
  key: AlmStackSegmentKey
  label: string
  amount: number
  /** 在「100% = 有效购置价」条内所占比例 0–1 */
  widthInBar: number
}

export type AlmStackComputation = {
  purchaseBase: number
  unpaidLoan: number
  yellowAmount: number
  pureProfitExcess: number
  segments: AlmStackSegment[]
  /** 纯利相对购置超出条长的部分（例如 0.62 表示还可画 62% 的第二条绿） */
  greenOverflowRatio: number
}

export function computeAlmStackSegments(input: {
  effectivePurchase: number
  unpaidLoanPrincipal: number
  paybackRemaining: number
  paybackExcess: number
}): AlmStackComputation {
  const P = Math.max(input.effectivePurchase, 1e-9)
  const L = Math.max(0, input.unpaidLoanPrincipal)
  const gap = Math.max(0, input.paybackRemaining)
  const yellowAmt = Math.max(0, gap - Math.min(L, gap))
  const greenExcess = Math.max(0, input.paybackExcess)

  const redW = Math.min(L / P, 1)
  const yellowW = Math.min(yellowAmt / P, Math.max(0, 1 - redW))
  const profitPortionOfP = greenExcess / P
  const profitInBarW = Math.min(profitPortionOfP, Math.max(0, 1 - redW - yellowW))
  const greenOverflowRatio = Math.max(0, profitPortionOfP - profitInBarW)

  const segments: AlmStackSegment[] = []
  if (L >= 0.01) {
    segments.push({ key: 'debt', label: '剩余贷款本金', amount: Math.round(L * 100) / 100, widthInBar: redW })
  }
  if (yellowAmt >= 0.01) {
    segments.push({
      key: 'own',
      label: '经营尚未覆盖的购置缺口（示意）',
      amount: Math.round(yellowAmt * 100) / 100,
      widthInBar: yellowW,
    })
  }
  if (greenExcess >= 0.01 && profitInBarW > 1e-6) {
    segments.push({
      key: 'profit',
      label: '较购置超额收回（条内部分）',
      amount: Math.round(greenExcess * 100) / 100,
      widthInBar: profitInBarW,
    })
  }

  return {
    purchaseBase: Math.round(P * 100) / 100,
    unpaidLoan: Math.round(L * 100) / 100,
    yellowAmount: Math.round(yellowAmt * 100) / 100,
    pureProfitExcess: Math.round(greenExcess * 100) / 100,
    segments,
    greenOverflowRatio: Math.round(greenOverflowRatio * 1000) / 1000,
  }
}
