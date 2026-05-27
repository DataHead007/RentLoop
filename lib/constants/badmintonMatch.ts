export const BADMINTON_MATCH_DISCIPLINES = [
  '男单',
  '女单',
  '男双',
  '女双',
  '混双',
  '团体',
  '其他',
] as const

export const BADMINTON_MATCH_PRIZE_MODES = ['none', 'cash', 'in_kind', 'both'] as const

export type BadmintonMatchDiscipline = (typeof BADMINTON_MATCH_DISCIPLINES)[number]
export type BadmintonMatchPrizeMode = (typeof BADMINTON_MATCH_PRIZE_MODES)[number]

export const BADMINTON_MATCH_PRIZE_MODE_LABELS: Record<BadmintonMatchPrizeMode, string> = {
  none: '无奖励',
  cash: '现金奖金',
  in_kind: '奖品',
  both: '现金 + 奖品',
}
