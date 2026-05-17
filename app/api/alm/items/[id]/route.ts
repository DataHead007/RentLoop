import { NextResponse } from 'next/server'
import { getItem, getItemStats, getFinancingLoans } from '@/lib/supabase/queries'
import { computeAlmStackSegments } from '@/lib/finance/almItemWaterfall'
import { apiError } from '@/lib/api/response'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await getItem(id)
    if (!item) return apiError('NOT_FOUND', '资产不存在', 404)

    const stats = await getItemStats(id, item)
    const loans = await getFinancingLoans(id)
    const unpaidLoan = loans
      .filter((l) => l.status === 'active')
      .reduce((s, l) => s + (parseFloat(String(l.principal_remaining ?? 0)) || 0), 0)

    const stack = computeAlmStackSegments({
      effectivePurchase: stats.effectivePurchaseCost,
      unpaidLoanPrincipal: unpaidLoan,
      paybackRemaining: stats.payback_remaining,
      paybackExcess: stats.payback_excess_amount,
    })

    return NextResponse.json({
      success: true,
      data: {
        itemId: id,
        effectivePurchaseCost: stats.effectivePurchaseCost,
        unpaidLoanPrincipal: Math.round(unpaidLoan * 100) / 100,
        operatingSurplus: stats.operating_surplus,
        paybackRemaining: stats.payback_remaining,
        paybackExcessAmount: stats.payback_excess_amount,
        ownerEquityPurchase: stats.owner_equity_purchase,
        financingDisbursementTotal: stats.financing_disbursement_total,
        stack,
      },
    })
  } catch (e) {
    console.error(e)
    return apiError('ALM_ITEM_FETCH_FAILED', e instanceof Error ? e.message : '加载失败', 500)
  }
}
