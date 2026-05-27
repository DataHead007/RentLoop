import {
  BADMINTON_MATCH_DISCIPLINES,
  BADMINTON_MATCH_PRIZE_MODES,
  type BadmintonMatchDiscipline,
  type BadmintonMatchPrizeMode,
} from '@/lib/constants/badmintonMatch'

export type BadmintonMatchRecordPayload = {
  event_name: string
  event_date: string
  location: string
  event_time: string | null
  discipline: BadmintonMatchDiscipline
  discipline_other: string | null
  result: string | null
  registration_fee: number
  prize_mode: BadmintonMatchPrizeMode
  prize_cash: number | null
  prize_in_kind_desc: string | null
  prize_in_kind_value: number | null
  reflection: string | null
}

function isDiscipline(v: string): v is BadmintonMatchDiscipline {
  return (BADMINTON_MATCH_DISCIPLINES as readonly string[]).includes(v)
}

function isPrizeMode(v: string): v is BadmintonMatchPrizeMode {
  return (BADMINTON_MATCH_PRIZE_MODES as readonly string[]).includes(v)
}

export function parseBadmintonMatchPayload(body: unknown):
  | { ok: true; data: BadmintonMatchRecordPayload }
  | { ok: false; message: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: '请求体无效' }
  }
  const b = body as Record<string, unknown>

  const event_name = typeof b.event_name === 'string' ? b.event_name.trim() : ''
  const event_date = typeof b.event_date === 'string' ? b.event_date.trim() : ''
  const location = typeof b.location === 'string' ? b.location.trim() : ''
  const disciplineRaw = typeof b.discipline === 'string' ? b.discipline.trim() : ''
  const discipline_other =
    typeof b.discipline_other === 'string' ? b.discipline_other.trim() || null : null
  const result = typeof b.result === 'string' ? b.result.trim() || null : null
  const reflection = typeof b.reflection === 'string' ? b.reflection.trim() || null : null

  const event_time =
    typeof b.event_time === 'string' && b.event_time.trim() !== '' ? b.event_time.trim() : null

  if (!event_name) return { ok: false, message: '请填写比赛名称' }
  if (!event_date) return { ok: false, message: '请填写比赛日期' }
  if (!location) return { ok: false, message: '请填写地点' }
  if (!isDiscipline(disciplineRaw)) return { ok: false, message: '请选择有效的项目' }
  if (disciplineRaw === '其他' && !discipline_other) {
    return { ok: false, message: '选择「其他」时请说明项目' }
  }

  const registration_fee = Number(b.registration_fee)
  if (!Number.isFinite(registration_fee) || registration_fee < 0) {
    return { ok: false, message: '报名费须为不小于 0 的数字' }
  }

  const prize_modeRaw = typeof b.prize_mode === 'string' ? b.prize_mode : 'none'
  if (!isPrizeMode(prize_modeRaw)) {
    return { ok: false, message: '奖励类型无效' }
  }
  const prize_mode = prize_modeRaw

  let prize_cash: number | null = null
  let prize_in_kind_desc: string | null = null
  let prize_in_kind_value: number | null = null

  if (prize_mode === 'cash' || prize_mode === 'both') {
    const cash = Number(b.prize_cash)
    if (!Number.isFinite(cash) || cash < 0) {
      return { ok: false, message: '请填写有效的现金奖金（≥ 0）' }
    }
    prize_cash = cash
  }

  if (prize_mode === 'in_kind' || prize_mode === 'both') {
    prize_in_kind_desc =
      typeof b.prize_in_kind_desc === 'string' ? b.prize_in_kind_desc.trim() || null : null
    const value = Number(b.prize_in_kind_value)
    if (!prize_in_kind_desc) {
      return { ok: false, message: '请填写奖品说明' }
    }
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, message: '请填写大于 0 的奖品估值' }
    }
    prize_in_kind_value = value
  }

  if (prize_mode === 'none') {
    prize_cash = null
    prize_in_kind_desc = null
    prize_in_kind_value = null
  }

  return {
    ok: true,
    data: {
      event_name,
      event_date,
      location,
      event_time,
      discipline: disciplineRaw,
      discipline_other: disciplineRaw === '其他' ? discipline_other : null,
      result,
      registration_fee,
      prize_mode,
      prize_cash,
      prize_in_kind_desc,
      prize_in_kind_value,
      reflection,
    },
  }
}
