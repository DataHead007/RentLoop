import { NextResponse } from 'next/server'
import { getTransactions, createTransaction, deleteTransaction } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'
import type { BusinessPlate, CreatorChannel } from '@/lib/types/businessPlate'

import { isPlateMigrationMissingFromDbError } from '@/lib/supabase/plateMigrationErrors'

function getErrorMessage(error: unknown): { status: number; message: string } {
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { code?: unknown; message?: unknown; details?: unknown }
    const code = typeof maybe.code === 'string' ? maybe.code : undefined
    const message = typeof maybe.message === 'string' ? maybe.message : undefined
    const details = typeof maybe.details === 'string' ? maybe.details : undefined

    if (code === '23514') {
      if (
        (message && message.includes('transactions_business_plate_check')) ||
        (details && details.includes('transactions_business_plate_check')) ||
        (message && message.includes('transactions_creator_channel_check')) ||
        (details && details.includes('transactions_creator_channel_check'))
      ) {
        return {
          status: 400,
          message: '板块或自媒体渠道不符合数据库约束（请执行 supabase/migration_business_plates.sql）',
        }
      }
      return { status: 400, message: message || '数据校验失败（违反数据库约束）' }
    }

    if (message) return { status: 500, message }
  }

  if (error instanceof Error) return { status: 500, message: error.message }
  return { status: 500, message: 'Unknown error' }
}

/** 解析 GET 筛选：支持 businessPlate + creatorChannel，以及旧参数 businessLine */
function parseTransactionFilters(searchParams: URLSearchParams): {
  business_plate?: BusinessPlate | 'all'
  creator_channel?: CreatorChannel | 'all'
} {
  let plate = searchParams.get('businessPlate')
  let channel = searchParams.get('creatorChannel')

  const legacy = searchParams.get('businessLine')
  if (!plate && legacy && legacy !== 'all') {
    if (legacy === 'rental') plate = 'rental'
    else if (legacy === 'badminton') plate = 'badminton'
    else if (legacy === 'youtube') {
      plate = 'creator'
      channel = 'youtube'
    } else if (legacy === 'wechat_video') {
      plate = 'creator'
      channel = 'wechat_video'
    }
  }

  const out: { business_plate?: BusinessPlate | 'all'; creator_channel?: CreatorChannel | 'all' } = {}
  if (plate && plate !== 'all') out.business_plate = plate as BusinessPlate
  if (channel && channel !== 'all') out.creator_channel = channel as CreatorChannel
  return out
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type') as 'income' | 'expense' | null
    const category = searchParams.get('category')

    const plateFilters = parseTransactionFilters(searchParams)

    const transactions = await getTransactions(itemId || undefined, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      type: type || undefined,
      category: category || undefined,
      ...plateFilters,
    })

    return NextResponse.json(transactions)
  } catch (error) {
    if (isPlateMigrationMissingFromDbError(error)) {
      return apiError(
        'DB_MIGRATION_REQUIRED',
        '交易列表依赖三大板块迁移。请先在 Supabase SQL Editor 执行 `supabase/migration_business_plates.sql`（为 transactions 增加 business_plate / creator_channel，并重定义 get_transaction_summary）。',
        400
      )
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch transactions'
    console.error('Error fetching transactions:', error)
    return apiError('TRANSACTIONS_FETCH_FAILED', message, 500)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const transaction = await createTransaction(body)
    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    const { status, message } = getErrorMessage(error)
    return apiError('TRANSACTION_CREATE_FAILED', message, status)
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return apiError('INVALID_REQUEST', 'Transaction ID is required', 400)
    }

    await deleteTransaction(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return apiError('TRANSACTION_DELETE_FAILED', 'Failed to delete transaction', 500)
  }
}
