import type { BadmintonMatchPrizeMode } from '@/lib/constants/badmintonMatch'

export type MatchNetProfitInput = {
  registration_fee: number
  prize_mode: BadmintonMatchPrizeMode
  prize_cash?: number | null
  prize_in_kind_value?: number | null
}

/** 本场净利 = (现金奖金 + 奖品估值) − 报名费 */
export function computeBadmintonMatchNetProfit(input: MatchNetProfitInput): number {
  const fee = Number(input.registration_fee) || 0
  let income = 0
  const mode = input.prize_mode
  if (mode === 'cash' || mode === 'both') {
    income += Number(input.prize_cash) || 0
  }
  if (mode === 'in_kind' || mode === 'both') {
    income += Number(input.prize_in_kind_value) || 0
  }
  return Math.round((income - fee) * 100) / 100
}

export function matchNetProfitIncludesInKindEstimate(prize_mode: BadmintonMatchPrizeMode): boolean {
  return prize_mode === 'in_kind' || prize_mode === 'both'
}
