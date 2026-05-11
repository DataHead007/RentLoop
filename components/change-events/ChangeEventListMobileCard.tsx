'use client'

import Link from 'next/link'
import type { TransactionChangeEvent } from '@/lib/types/database'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Edit, Plus, Sparkles, Trash2 } from 'lucide-react'

function formatDateTime(dateStr: string) {
  return format(new Date(dateStr), 'MM-dd HH:mm:ss')
}

function formatDelta(value: number, type: 'income' | 'expense' | 'net') {
  if (value === 0) return <span className="text-muted-foreground">-</span>

  const isPositive = value > 0
  const color =
    type === 'net'
      ? isPositive
        ? 'text-green-600'
        : 'text-red-600'
      : type === 'income'
        ? isPositive
          ? 'text-green-600'
          : 'text-red-600'
        : isPositive
          ? 'text-red-600'
          : 'text-green-600'

  return (
    <span className={cn('font-medium tabular-nums', color)}>
      {isPositive ? '+' : ''}
      {formatCurrency(value)}
    </span>
  )
}

function ActionBadge({ action }: { action: string }) {
  switch (action) {
    case 'insert':
      return (
        <Badge variant="success" className="gap-1">
          <Plus className="h-3 w-3" />
          新增
        </Badge>
      )
    case 'update':
      return (
        <Badge variant="outline" className="gap-1">
          <Edit className="h-3 w-3" />
          修改
        </Badge>
      )
    case 'delete':
      return (
        <Badge variant="destructive" className="gap-1">
          <Trash2 className="h-3 w-3" />
          删除
        </Badge>
      )
    default:
      return <Badge variant="secondary">{action}</Badge>
  }
}

type Props = { event: TransactionChangeEvent }

export function ChangeEventListMobileCard({ event }: Props) {
  return (
    <article className="min-w-0 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <ActionBadge action={event.action} />
        {event.auto_created ? (
          <Badge variant="outline" className="gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            自动
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            手动
          </Badge>
        )}
        <span className="ml-auto font-mono text-xs text-muted-foreground">{formatDateTime(event.created_at)}</span>
      </div>

      <div className="mt-3 min-w-0 space-y-2 border-t border-border/60 pt-3">
        <p className="text-sm font-medium break-words">{event.summary || '-'}</p>
        {event.description && (
          <p className="break-words text-xs text-muted-foreground">{event.description}</p>
        )}
        <div className="flex flex-wrap gap-2 text-xs">
          {event.order_id && (
            <Link href={`/orders/${event.order_id}`} className="text-primary underline-offset-2 hover:underline">
              订单 {event.order_id.slice(0, 8)}…
            </Link>
          )}
          {event.item_id && (
            <Link href={`/items/${event.item_id}`} className="text-primary underline-offset-2 hover:underline">
              资产 {event.item_id.slice(0, 8)}…
            </Link>
          )}
        </div>
      </div>

      <dl className="mt-3 grid gap-2 border-t border-border/60 pt-3 text-sm">
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-xs text-muted-foreground">类别</dt>
          <dd className="min-w-0 break-words">{event.category || '-'}</dd>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <div>
            <span className="text-xs text-muted-foreground">收入Δ </span>
            {formatDelta(event.delta_income, 'income')}
          </div>
          <div>
            <span className="text-xs text-muted-foreground">支出Δ </span>
            {formatDelta(event.delta_expense, 'expense')}
          </div>
          <div>
            <span className="text-xs text-muted-foreground">净利Δ </span>
            {formatDelta(event.delta_net_profit, 'net')}
          </div>
        </div>
      </dl>
    </article>
  )
}
