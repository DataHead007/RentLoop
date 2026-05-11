'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { Order } from '@/lib/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  MapPin,
  Package,
  RotateCcw,
  Sparkles,
  Trash2,
  Truck,
} from 'lucide-react'
import { formatCurrency, formatDateShort, getDaysUntilEnd, getDaysUntilStart } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

type ShipSuggestion = {
  recommendShipBy: string
  suggestedExpress: string
}

type OrderListMobileCardProps = {
  order: Order
  isBadmintonOnlyView: boolean
  getCategoryIcon: (categoryName: string | undefined | null) => ReactNode
  shipSuggestions: Record<string, ShipSuggestion>
  shipSuggestionLoadingId: string | null
  fetchShipSuggestion: (order: Order) => void
  setShippingDialogOrder: (order: Order) => void
  setQuickCompleteOrder: (order: Order) => void
  setRollbackOrder: (order: Order) => void
  setOrderToDelete: (order: Order) => void
  setDeleteDialogOpen: (open: boolean) => void
  getRowBackgroundClass: (status: string, isUrgent: boolean) => string
  getStatusBadgeVariant: (status: string) =>
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline'
    | 'success'
    | 'warning'
    | null
    | undefined
  getStatusBadgeClassName: (status: string) => string
  getStatusLabel: (status: string, isBadminton?: boolean) => string
}

export function OrderListMobileCard(props: OrderListMobileCardProps) {
  const {
    order,
    isBadmintonOnlyView,
    getCategoryIcon,
    shipSuggestions,
    shipSuggestionLoadingId,
    fetchShipSuggestion,
    setShippingDialogOrder,
    setQuickCompleteOrder,
    setRollbackOrder,
    setOrderToDelete,
    setDeleteDialogOpen,
    getRowBackgroundClass,
    getStatusBadgeVariant,
    getStatusBadgeClassName,
    getStatusLabel,
  } = props

  const isBadminton = (order as { order_type?: string }).order_type === 'badminton'
  const orderItems = order.order_items || []
  const itemCount = orderItems.length
  const firstItem = orderItems[0]?.item
  const categoryIcon = getCategoryIcon(firstItem?.category?.name)
  const daysUntilStart = getDaysUntilStart(order.start_date)
  const daysUntilEnd = getDaysUntilEnd(order.end_date)
  const isUrgent =
    !isBadminton &&
    order.status === 'in_progress' &&
    daysUntilStart < 0 &&
    daysUntilEnd >= 0 &&
    daysUntilEnd <= 2
  const st = (order as { service_start_time?: string }).service_start_time
  const et = (order as { service_end_time?: string }).service_end_time
  const timeRange = st && et ? ` ${String(st).slice(0, 5)}–${String(et).slice(0, 5)}` : ''

  const dateBlock = isBadminton ? (
    <span className="text-sm">
      {formatDateShort((order as { service_date?: string }).service_date || order.start_date)}
      {timeRange}
    </span>
  ) : (
    (() => {
      const isNotShipped = (order.status === 'pending' || order.status === 'confirmed') && daysUntilStart >= 0
      const isInProgress = order.status === 'in_progress' && daysUntilStart < 0 && daysUntilEnd >= 0
      return (
        <div className="space-y-1">
          {isNotShipped ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Truck className="h-4 w-4 shrink-0 text-blue-500" />
                <span className={cn('text-sm font-medium', daysUntilStart <= 3 && 'text-blue-600')}>
                  开始: {formatDateShort(order.start_date)}
                </span>
                {daysUntilStart >= 0 && (
                  <Badge
                    variant="secondary"
                    className={cn(daysUntilStart <= 3 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700')}
                  >
                    {daysUntilStart === 0 ? '今天' : `还有${daysUntilStart}天`}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Package className="h-4 w-4 shrink-0 text-orange-500" />
                <span className="text-sm font-medium">结束: {formatDateShort(order.end_date)}</span>
              </div>
              {order.customer_address?.trim() && (
                <div className="mt-2 border-t border-border/60 pt-2">
                  {shipSuggestions[order.id] ? (
                    <div className="text-xs text-foreground">
                      <span className="font-medium">建议最晚 {shipSuggestions[order.id].recommendShipBy} 发货</span>
                      <span className="ml-1 text-muted-foreground">（{shipSuggestions[order.id].suggestedExpress}）</span>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                      onClick={() => fetchShipSuggestion(order)}
                      disabled={shipSuggestionLoadingId === order.id}
                    >
                      {shipSuggestionLoadingId === order.id ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                      )}
                      AI 推荐发货
                    </Button>
                  )}
                </div>
              )}
            </>
          ) : isInProgress ? (
            <div className="flex flex-wrap items-center gap-2">
              <Package className="h-4 w-4 shrink-0 text-orange-500" />
              <span
                className={cn(
                  'text-sm font-medium',
                  daysUntilEnd <= 2 && 'text-red-600',
                  daysUntilEnd > 2 && daysUntilEnd <= 7 && 'text-orange-600'
                )}
              >
                结束: {formatDateShort(order.end_date)}
              </span>
              {daysUntilEnd <= 7 && (
                <Badge
                  variant={daysUntilEnd <= 2 ? 'destructive' : 'secondary'}
                  className={daysUntilEnd > 2 ? 'bg-orange-100 text-orange-700' : ''}
                >
                  {daysUntilEnd === 0 ? '今天到期' : `还有${daysUntilEnd}天到期`}
                </Badge>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {formatDateShort(order.start_date)} – {formatDateShort(order.end_date)}
            </div>
          )}
        </div>
      )
    })()
  )

  return (
    <article
      className={cn(
        'min-w-0 rounded-xl border border-border/70 p-4 shadow-sm',
        getRowBackgroundClass(order.status, isUrgent)
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant={isBadminton ? 'secondary' : 'outline'}
            className={isBadminton ? 'bg-emerald-100 text-emerald-800' : ''}
          >
            {isBadminton ? '羽毛球' : '租赁'}
          </Badge>
          <Badge variant={getStatusBadgeVariant(order.status)} className={getStatusBadgeClassName(order.status)}>
            {getStatusLabel(order.status, isBadminton)}
          </Badge>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {order.order_number || order.id.slice(0, 8)}
        </span>
      </div>

      <dl className="mt-3 min-w-0 space-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{isBadmintonOnlyView ? '服务' : '设备/服务'}</dt>
          <dd className="mt-0.5 min-w-0 break-words">
            {isBadminton ? (
              <div>
                <div className="font-medium">{(order as { service_type?: string }).service_type || '-'}</div>
                <div className="text-sm text-muted-foreground">{(order as { location?: string }).location || '-'}</div>
              </div>
            ) : firstItem ? (
              <div className="flex min-w-0 items-start gap-2">
                {categoryIcon && <span className="mt-0.5 shrink-0">{categoryIcon}</span>}
                <div className="min-w-0">
                  <div className="font-medium">{firstItem.short_name?.trim() || firstItem.name}</div>
                  {firstItem.category && (
                    <div className="text-muted-foreground">{firstItem.category.name}</div>
                  )}
                  {itemCount > 1 && (
                    <div className="mt-1 text-xs text-muted-foreground">等 {itemCount} 项</div>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-muted-foreground">客户</dt>
          <dd className="mt-0.5 min-w-0 break-words">
            <div>{order.customer_name}</div>
            {order.customer_phone && (
              <div className="text-xs text-muted-foreground">{order.customer_phone}</div>
            )}
            {!isBadminton && order.customer_address?.trim() && (
              <div className="relative mt-1 inline-block pt-0.5 group">
                <button
                  type="button"
                  aria-label="查看详细地址"
                  className="inline-flex cursor-help items-center text-muted-foreground hover:text-foreground focus-visible:text-foreground"
                >
                  <MapPin className="h-3.5 w-3.5" />
                </button>
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-[min(18rem,calc(100vw-2rem))] rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md group-hover:block group-focus-within:block"
                >
                  <div className="mb-1 font-medium">客户地址</div>
                  <div className="break-words leading-relaxed text-muted-foreground whitespace-normal">
                    {order.customer_address}
                  </div>
                </div>
              </div>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            {isBadmintonOnlyView ? '上课时间' : '日期'}
          </dt>
          <dd className="mt-0.5 min-w-0">{dateBlock}</dd>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-sm">
          <div>
            <span className="text-muted-foreground">总金额 </span>
            <span className="font-semibold tabular-nums">{formatCurrency(order.total_amount)}</span>
          </div>
          {!isBadmintonOnlyView && (
            <div>
              <span className="text-muted-foreground">押金 </span>
              <span className="tabular-nums">{order.total_deposit > 0 ? formatCurrency(order.total_deposit) : '-'}</span>
            </div>
          )}
        </div>
      </dl>

      <div className="mt-3 flex min-w-0 flex-wrap gap-2 border-t border-border/60 pt-3">
        {!isBadminton && (order.status === 'pending' || order.status === 'confirmed') && (
          <Button
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => setShippingDialogOrder(order)}
          >
            <Truck className="mr-1 h-3.5 w-3.5" />
            快速发货
          </Button>
        )}
        {!isBadminton && order.status === 'in_progress' && (
          <Button
            size="sm"
            className="bg-green-600 text-white hover:bg-green-700"
            onClick={() => setQuickCompleteOrder(order)}
          >
            <Package className="mr-1 h-3.5 w-3.5" />
            快速收货
          </Button>
        )}
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link href={`/orders/${order.id}`}>查看详情</Link>
        </Button>
        {order.status === 'completed' && !isBadminton && (
          <Button variant="outline" size="sm" className="text-muted-foreground" onClick={() => setRollbackOrder(order)}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            回退
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            setOrderToDelete(order)
            setDeleteDialogOpen(true)
          }}
          aria-label="删除订单"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  )
}
