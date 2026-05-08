'use client'

import { useState, useEffect } from 'react'
import { OrderFormV2 } from '@/components/orders/OrderFormV2'
import { BadmintonOrderForm } from '@/components/orders/BadmintonOrderForm'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import type { Order } from '@/lib/types/database'

export default function EditOrderPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrder()
  }, [orderId])

  async function loadOrder() {
    try {
      const res = await fetch(`/api/orders/${orderId}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail = (err as { errorDetail?: { message?: string } }).errorDetail?.message
        throw new Error(
          detail ||
            (err as { error?: string; message?: string }).message ||
            (err as { error?: string }).error ||
            '加载订单失败'
        )
      }
      const data: Order = await res.json()
      setOrder(data)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : '加载订单失败')
      router.push('/orders')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 max-w-5xl">
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">加载中...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container mx-auto py-8 max-w-5xl">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground">订单不存在</p>
              <button onClick={() => router.push('/orders')} className="mt-4 text-sm text-muted-foreground hover:underline">
                返回订单列表
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isBadminton = (order as any).order_type === 'badminton'

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">编辑订单</h1>
        <p className="text-muted-foreground">
          {isBadminton ? '修改羽毛球副业订单信息' : '修改租赁订单信息'}
        </p>
      </div>
      {isBadminton ? (
        <BadmintonOrderForm
          orderId={orderId}
          onSuccess={() => router.push(`/orders/${orderId}`)}
        />
      ) : (
        <OrderFormV2
          orderId={orderId}
          onSuccess={() => router.push(`/orders/${orderId}`)}
        />
      )}
    </div>
  )
}
