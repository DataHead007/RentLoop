import { NextResponse } from 'next/server'
import { createShippingFee, deleteShippingFee, getOrder, updateOrder } from '@/lib/supabase/queries'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const fee = await createShippingFee(body)
    const orderId = fee.order_id
    if (orderId) {
      const order = await getOrder(orderId)
      const total = (order?.shipping_fees ?? []).reduce((s, f) => s + (Number((f as any).amount) || 0), 0)
      await updateOrder(orderId, { total_shipping_cost: total })
    }
    return NextResponse.json(fee, { status: 201 })
  } catch (error: any) {
    console.error('Error creating shipping fee:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create shipping fee' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Shipping fee ID is required' },
        { status: 400 }
      )
    }
    
    await deleteShippingFee(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting shipping fee:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete shipping fee' },
      { status: 500 }
    )
  }
}
