import { NextResponse } from 'next/server'
import { getRentalGlobalWalletExclusionReport } from '@/lib/finance/almService'
import {
  RENTAL_ALM_EXPENSE_WHITELIST,
  RENTAL_ALM_INCOME_WHITELIST,
  GLOBAL_WALLET_EXCLUDED_INCOME,
} from '@/lib/finance/almConstants'
import { apiError } from '@/lib/api/response'

export async function GET() {
  try {
    const report = await getRentalGlobalWalletExclusionReport()
    const excludedSignedTotal = Math.round(
      report.rows.reduce((s, r) => s + r.amount, 0) * 100
    ) / 100

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        excludedSignedTotal,
        whitelists: {
          income: RENTAL_ALM_INCOME_WHITELIST,
          expense: RENTAL_ALM_EXPENSE_WHITELIST,
          excludedIncomeByPolicy: GLOBAL_WALLET_EXCLUDED_INCOME,
        },
      },
    })
  } catch (e) {
    console.error(e)
    return apiError('ALM_RENTAL_EXCLUSIONS_FAILED', e instanceof Error ? e.message : '加载失败', 500)
  }
}
