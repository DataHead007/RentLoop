import { NextResponse } from 'next/server'
import { getTransaction, updateTransaction, deleteTransaction } from '@/lib/supabase/queries'
import { apiError } from '@/lib/api/response'

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
    const transaction = await updateTransaction(id, body)
    return NextResponse.json(transaction)
  } catch (error: any) {
    console.error('Error updating transaction:', error)
    return apiError('TRANSACTION_UPDATE_FAILED', error.message || 'Failed to update transaction', 500)
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
