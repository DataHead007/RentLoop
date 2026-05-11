'use client'

import { useState } from 'react'
import Link from 'next/link'
import { OrderFormV2 } from '@/components/orders/OrderFormV2'
import { BadmintonOrderForm } from '@/components/orders/BadmintonOrderForm'
import { cn } from '@/lib/utils'
import { Package, Activity } from 'lucide-react'

type OrderType = 'rental' | 'badminton' | null

export default function NewOrderPage() {
  const [orderType, setOrderType] = useState<OrderType>(null)

  if (orderType === null) {
    return (
      <div className="container mx-auto min-w-0 w-full max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">新建订单</h1>
          <p className="text-muted-foreground">选择订单类型</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setOrderType('rental')}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-card p-8 text-left transition-colors hover:border-primary hover:bg-accent/50"
          >
            <Package className="h-12 w-12 text-muted-foreground" />
            <div>
              <div className="font-semibold">租赁订单</div>
              <div className="text-sm text-muted-foreground">设备租赁、游戏账号等</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setOrderType('badminton')}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-card p-8 text-left transition-colors hover:border-primary hover:bg-accent/50"
          >
            <Activity className="h-12 w-12 text-muted-foreground" />
            <div>
              <div className="font-semibold">羽毛球副业</div>
              <div className="text-sm text-muted-foreground">教学、陪打、比赛、活动</div>
            </div>
          </button>
        </div>
        <div className="mt-6 space-y-1">
          <p className="text-xs text-muted-foreground">
            日常也可从导航直接进入{' '}
            <Link href="/rental/orders" className="underline hover:text-foreground">
              租赁订单
            </Link>{' '}
            或{' '}
            <Link href="/badminton/orders" className="underline hover:text-foreground">
              羽毛球订单
            </Link>
            。
          </p>
          <Link href="/orders" className="text-sm text-muted-foreground hover:underline">
            返回全部订单
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto min-w-0 w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <button
          type="button"
          onClick={() => setOrderType(null)}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← 更换类型
        </button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {orderType === 'rental' ? '新建租赁订单' : '新建羽毛球订单'}
          </h1>
          <p className="text-muted-foreground">
            {orderType === 'rental' ? '创建新的租赁订单' : '创建羽毛球副业订单'}
          </p>
        </div>
      </div>
      {orderType === 'rental' ? <OrderFormV2 /> : <BadmintonOrderForm />}
    </div>
  )
}
