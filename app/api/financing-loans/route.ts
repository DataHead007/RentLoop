import { NextResponse } from 'next/server'
import { createFinancingLoan, createTransaction, getFinancingLoans, getItem } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId') || undefined
    const loans = await getFinancingLoans(itemId)
    return NextResponse.json(loans)
  } catch (e) {
    console.error(e)
    return apiError('FINANCING_LOANS_FETCH_FAILED', e instanceof Error ? e.message : '加载失败', 500)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const item_id = body.item_id as string | undefined
    const principal_total = Number(body.principal_total)
    const annual_rate_percent = Number(body.annual_rate_percent)
    const repayment_day_of_month = parseInt(String(body.repayment_day_of_month), 10)
    const start_date = body.start_date as string | undefined
    const title = (body.title as string | undefined)?.trim() || null
    const notes = (body.notes as string | undefined)?.trim() || null

    if (!item_id?.trim()) {
      return apiError('INVALID_REQUEST', '请选择资产', 400)
    }
    if (!Number.isFinite(principal_total) || principal_total <= 0) {
      return apiError('INVALID_REQUEST', '借款本金必须大于 0', 400)
    }
    if (!Number.isFinite(annual_rate_percent) || annual_rate_percent < 0) {
      return apiError('INVALID_REQUEST', '年化利率无效', 400)
    }
    if (!Number.isInteger(repayment_day_of_month) || repayment_day_of_month < 1 || repayment_day_of_month > 28) {
      return apiError('INVALID_REQUEST', '还款日须为 1–28 的整数', 400)
    }
    if (!start_date?.trim()) {
      return apiError('INVALID_REQUEST', '请填写起息日', 400)
    }

    const existing = await getFinancingLoans(item_id)
    const active = existing.find((l) => l.status === 'active')
    if (active) {
      return apiError('INVALID_REQUEST', '该资产已有一笔进行中的融资，请先结清或关闭后再新建', 400)
    }

    const itemRow = await getItem(item_id.trim())
    const itemPurchase = itemRow?.purchase_price != null ? Number(itemRow.purchase_price) : 0
    if (Number.isFinite(itemPurchase) && itemPurchase > 0 && principal_total > itemPurchase + 1e-6) {
      return apiError('INVALID_REQUEST', '借款本金不能大于该资产的购买总价', 400)
    }

    const loan = await createFinancingLoan({
      item_id,
      title,
      principal_total,
      annual_rate_percent,
      repayment_day_of_month,
      start_date: start_date.trim(),
      notes,
    })

    // 放款入账（现金流），用于与“归还借款本金”形成完整闭环。
    // 不阻断主流程，避免“融资已创建但接口返回失败”导致用户重复提交。
    let transactionWarning: string | null = null
    try {
      await createTransaction({
        order_id: null,
        item_id,
        type: 'income',
        amount: Math.abs(principal_total),
        category: '融资放款入账',
        description: `融资借款「${title || loan.item?.name || '未命名'}」· 放款入账（${start_date.trim()}）`,
        transaction_date: start_date.trim(),
        auto_created: true,
        business_plate: 'rental',
        creator_channel: null,
      })
    } catch (txErr) {
      console.error('Failed to create financing disbursement transaction:', txErr)
      transactionWarning = '融资已创建，但放款入账交易写入失败，可在交易记录中手动补录“融资放款入账”'
    }

    return NextResponse.json(
      transactionWarning
        ? { ...loan, transaction_warning: transactionWarning }
        : loan,
      { status: 201 }
    )
  } catch (e: unknown) {
    console.error(e)
    const msg = e instanceof Error ? e.message : '创建失败'
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === '23505') {
      return apiError('INVALID_REQUEST', '该资产已存在进行中的融资记录', 400)
    }
    return apiError('FINANCING_LOAN_CREATE_FAILED', msg, 500)
  }
}
