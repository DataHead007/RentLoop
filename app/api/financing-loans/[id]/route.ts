import { NextResponse } from 'next/server'
import { getFinancingLoanById, getFinancingLoanPayments } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const loan = await getFinancingLoanById(id)
    if (!loan) {
      return apiError('NOT_FOUND', '融资记录不存在', 404)
    }
    const payments = await getFinancingLoanPayments(id)
    return NextResponse.json({ ...loan, payments })
  } catch (e) {
    console.error(e)
    return apiError('FINANCING_LOAN_FETCH_FAILED', e instanceof Error ? e.message : '加载失败', 500)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const loan = await getFinancingLoanById(id)
    if (!loan) {
      return apiError('NOT_FOUND', '融资记录不存在', 404)
    }

    // 1) 先删除还款关联的交易（利息/本金）
    const payments = await getFinancingLoanPayments(id)
    const paymentTxIds = Array.from(
      new Set(
        payments.flatMap((p) => [p.interest_transaction_id, p.principal_transaction_id]).filter(Boolean) as string[]
      )
    )
    if (paymentTxIds.length > 0) {
      const { error: delTxErr } = await supabaseServer
        .from('transactions')
        .delete()
        .in('id', paymentTxIds)
      if (delTxErr) throw delTxErr
    }

    // 2) 尝试删除该融资对应的“放款入账”交易（仅删除一条最匹配记录）
    // 说明：历史数据里未存 financing_loan_id，只能按业务特征匹配，避免误删。
    const { data: disbursementRows, error: disbursementFetchErr } = await supabaseServer
      .from('transactions')
      .select('id, created_at')
      .eq('item_id', loan.item_id)
      .eq('type', 'income')
      .eq('category', '融资放款入账')
      .eq('auto_created', true)
      .eq('transaction_date', loan.start_date)
      .eq('amount', loan.principal_total)
      .order('created_at', { ascending: false })
      .limit(1)
    if (disbursementFetchErr) throw disbursementFetchErr

    const disbursementTxId = disbursementRows?.[0]?.id
    if (disbursementTxId) {
      const { error: delDisbursementErr } = await supabaseServer
        .from('transactions')
        .delete()
        .eq('id', disbursementTxId)
      if (delDisbursementErr) throw delDisbursementErr
    }

    // 3) 删除融资主单（payments 通过 ON DELETE CASCADE 自动删除）
    const { error: deleteLoanErr } = await supabaseServer.from('financing_loans').delete().eq('id', id)
    if (deleteLoanErr) throw deleteLoanErr

    return NextResponse.json({
      success: true,
      deletedLoanId: id,
      deletedPaymentTransactionCount: paymentTxIds.length,
      deletedDisbursementTransaction: Boolean(disbursementTxId),
    })
  } catch (e) {
    console.error(e)
    return apiError('FINANCING_LOAN_DELETE_FAILED', e instanceof Error ? e.message : '删除失败', 500)
  }
}
