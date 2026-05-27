import { createTransaction } from '@/lib/supabase/queries'
import { supabaseServer } from '@/lib/supabase/server'
import { formatMatchDiscipline } from '@/lib/badminton/matchDisplay'
import type { BadmintonMatchRecord } from '@/lib/types/database'

const EXPENSE_CATEGORY = '比赛报名费'
const INCOME_CATEGORY = '比赛奖金'

function buildMatchLabel(record: BadmintonMatchRecord): string {
  return record.event_name.trim() || '未命名比赛'
}

/** 删除该比赛下所有自动生成的交易，再按当前数据重建 */
export async function syncBadmintonMatchTransactions(record: BadmintonMatchRecord): Promise<number> {
  const matchId = record.id
  const { error: delErr } = await supabaseServer
    .from('transactions')
    .delete()
    .eq('badminton_match_record_id', matchId)
    .eq('auto_created', true)

  if (delErr) throw delErr

  const label = buildMatchLabel(record)
  const discipline = formatMatchDiscipline(record)
  const txDate = record.event_date
  let created = 0

  const fee = Number(record.registration_fee) || 0
  if (fee > 0) {
    await createTransaction({
      order_id: null,
      item_id: null,
      badminton_match_record_id: matchId,
      type: 'expense',
      amount: -fee,
      category: EXPENSE_CATEGORY,
      description: `比赛「${label}」· 报名费（${discipline}）`,
      transaction_date: txDate,
      auto_created: true,
      business_plate: 'badminton',
      creator_channel: null,
    })
    created += 1
  }

  if (record.prize_mode === 'cash' || record.prize_mode === 'both') {
    const cash = Number(record.prize_cash) || 0
    if (cash > 0) {
      await createTransaction({
        order_id: null,
        item_id: null,
        badminton_match_record_id: matchId,
        type: 'income',
        amount: cash,
        category: INCOME_CATEGORY,
        description: `比赛「${label}」· 现金奖金（${discipline}）`,
        transaction_date: txDate,
        auto_created: true,
        business_plate: 'badminton',
        creator_channel: null,
      })
      created += 1
    }
  }

  if (record.prize_mode === 'in_kind' || record.prize_mode === 'both') {
    const value = Number(record.prize_in_kind_value) || 0
    if (value > 0) {
      const prizeDesc = record.prize_in_kind_desc?.trim() || '奖品'
      await createTransaction({
        order_id: null,
        item_id: null,
        badminton_match_record_id: matchId,
        type: 'income',
        amount: value,
        category: INCOME_CATEGORY,
        description: `比赛「${label}」· 奖品估值：${prizeDesc}（${discipline}）`,
        transaction_date: txDate,
        auto_created: true,
        business_plate: 'badminton',
        creator_channel: null,
      })
      created += 1
    }
  }

  return created
}
