import { NextResponse } from 'next/server'
import { createTransaction, getFinancingLoanById } from '@/lib/supabase/queries'
import { supabaseServer } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/response'

const CATEGORY_INTEREST = '融资成本'
const CATEGORY_PRINCIPAL = '归还借款本金'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: loanId } = await params
    const body = await request.json()
    const payment_date = body.payment_date as string | undefined
    const interest_amount = Math.round(Number(body.interest_amount || 0) * 100) / 100
    const principal_amount = Math.round(Number(body.principal_amount || 0) * 100) / 100
    const note = (body.note as string | undefined)?.trim() || null

    if (!payment_date?.trim()) {
      return apiError('INVALID_REQUEST', '请填写还款日期', 400)
    }
    if (interest_amount <= 0 && principal_amount <= 0) {
      return apiError('INVALID_REQUEST', '利息与本金至少填写一项且大于 0', 400)
    }
    if (interest_amount < 0 || principal_amount < 0) {
      return apiError('INVALID_REQUEST', '金额不能为负', 400)
    }

    const loan = await getFinancingLoanById(loanId)
    if (!loan) {
      return apiError('NOT_FOUND', '融资记录不存在', 404)
    }
    if (loan.status !== 'active') {
      return apiError('INVALID_REQUEST', '该融资已结清，无法继续还款', 400)
    }
    if (principal_amount > loan.principal_remaining + 1e-6) {
      return apiError('INVALID_REQUEST', '归还本金不能超过剩余本金', 400)
    }

    const itemId = loan.item_id
    const descPrefix = `融资借款「${loan.title || loan.item?.name || '未命名'}」`

    let interestTxId: string | null = null
    let principalTxId: string | null = null

    if (interest_amount > 0) {
      const tx = await createTransaction({
        order_id: null,
        item_id: itemId,
        type: 'expense',
        amount: -Math.abs(interest_amount),
        category: CATEGORY_INTEREST,
        description: `${descPrefix} · 利息还款（${payment_date}）`,
        transaction_date: payment_date.trim(),
        auto_created: false,
        business_plate: 'rental',
        creator_channel: null,
      })
      interestTxId = tx.id
    }

    if (principal_amount > 0) {
      const tx = await createTransaction({
        order_id: null,
        item_id: itemId,
        type: 'expense',
        amount: -Math.abs(principal_amount),
        category: CATEGORY_PRINCIPAL,
        description: `${descPrefix} · 归还本金（${payment_date}）`,
        transaction_date: payment_date.trim(),
        auto_created: false,
        business_plate: 'rental',
        creator_channel: null,
      })
      principalTxId = tx.id
    }

    const newRemaining = Math.round((loan.principal_remaining - principal_amount) * 100) / 100
    const { data: paymentRow, error: payErr } = await supabaseServer
      .from('financing_loan_payments')
      .insert({
        loan_id: loanId,
        payment_date: payment_date.trim(),
        interest_amount,
        principal_amount,
        interest_transaction_id: interestTxId,
        principal_transaction_id: principalTxId,
        note,
      })
      .select('*')
      .single()

    if (payErr) throw payErr

    const nextStatus = newRemaining <= 0 ? 'closed' : 'active'
    const { error: updErr } = await supabaseServer
      .from('financing_loans')
      .update({
        principal_remaining: Math.max(0, newRemaining),
        status: nextStatus,
      })
      .eq('id', loanId)

    if (updErr) throw updErr

    return NextResponse.json({ payment: paymentRow, principal_remaining: Math.max(0, newRemaining), status: nextStatus })
  } catch (e) {
    console.error(e)
    return apiError('FINANCING_PAYMENT_FAILED', e instanceof Error ? e.message : '记录还款失败', 500)
  }
}
