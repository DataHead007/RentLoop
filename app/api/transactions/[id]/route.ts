import { NextResponse } from 'next/server'
import { getTransaction, updateTransaction, deleteTransaction } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'
import { normalizeTransactionPlateInput } from '@/lib/finance/transactionPlate'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const transaction = await getTransaction(id)
    if (!transaction) {
      return apiError('NOT_FOUND', 'Transaction not found', 404)
    }
    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error fetching transaction:', error)
    return apiError('TRANSACTION_FETCH_FAILED', 'Failed to fetch transaction', 500)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const existing = await getTransaction(id)
    if (!existing) {
      return apiError('NOT_FOUND', 'Transaction not found', 404)
    }
    const normalized = normalizeTransactionPlateInput({
      business_plate: body.business_plate ?? existing.business_plate,
      creator_channel:
        body.creator_channel !== undefined ? body.creator_channel : existing.creator_channel,
    })
    const transaction = await updateTransaction(id, {
      ...body,
      business_plate: normalized.business_plate,
      creator_channel: normalized.creator_channel,
    })
    return NextResponse.json(transaction)
  } catch (error: unknown) {
    console.error('Error updating transaction:', error)
    const msg = error instanceof Error ? error.message : 'Failed to update transaction'
    return apiError('TRANSACTION_UPDATE_FAILED', msg, 500)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteTransaction(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting transaction:', error)
    return apiError('TRANSACTION_DELETE_FAILED', error.message || 'Failed to delete transaction', 500)
  }
}
