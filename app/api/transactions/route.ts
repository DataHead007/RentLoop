import { NextResponse } from 'next/server'
import { getTransactions, createTransaction, deleteTransaction } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

function getErrorMessage(error: unknown): { status: number; message: string } {
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { code?: unknown; message?: unknown; details?: unknown }
    const code = typeof maybe.code === 'string' ? maybe.code : undefined
    const message = typeof maybe.message === 'string' ? maybe.message : undefined
    const details = typeof maybe.details === 'string' ? maybe.details : undefined

    // Postgres: check constraint violation
    if (code === '23514') {
      // Most common case in this app: business_line enum/check not yet migrated
      if ((message && message.includes('transactions_business_line_check')) || (details && details.includes('transactions_business_line_check'))) {
        return {
          status: 400,
          message: '数据库未启用该业务线（请执行 supabase/migration_wechat_video.sql 更新 transactions.business_line 约束）',
        }
      }
      return { status: 400, message: message || '数据校验失败（违反数据库约束）' }
    }

    if (message) return { status: 500, message }
  }

  if (error instanceof Error) return { status: 500, message: error.message }
  return { status: 500, message: 'Unknown error' }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type') as 'income' | 'expense' | null
    const category = searchParams.get('category')
    const businessLine = searchParams.get('businessLine') as
      | 'rental'
      | 'badminton'
      | 'youtube'
      | 'wechat_video'
      | 'all'
      | null

    const transactions = await getTransactions(itemId || undefined, {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      type: type || undefined,
      category: category || undefined,
      business_line: businessLine || undefined,
    })

    return NextResponse.json(transactions)
  } catch (error) {
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
