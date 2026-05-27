import type { BadmintonMatchRecord } from '@/lib/types/database'
import { BADMINTON_MATCH_PRIZE_MODE_LABELS } from '@/lib/constants/badmintonMatch'
import type { BadmintonMatchPrizeMode } from '@/lib/constants/badmintonMatch'

export function formatMatchDiscipline(record: Pick<BadmintonMatchRecord, 'discipline' | 'discipline_other'>): string {
  if (record.discipline === '其他' && record.discipline_other?.trim()) {
    return record.discipline_other.trim()
  }
  return record.discipline
}

export function formatPrizeModeLabel(mode: BadmintonMatchPrizeMode): string {
  return BADMINTON_MATCH_PRIZE_MODE_LABELS[mode]
}
