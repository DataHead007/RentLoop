'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { ItemWithStats } from '@/lib/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Trash2, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

type ItemListMobileCardProps = {
  item: ItemWithStats
  index: number
  getCategoryIcon: (categoryName: string | undefined | null) => ReactNode
  getStatusBadgeVariant: (status: string) => 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | null | undefined
  getStatusLabel: (status: string) => string
  onDelete: (item: ItemWithStats) => void
}

export function ItemListMobileCard({
  item,
  index,
  getCategoryIcon,
  getStatusBadgeVariant,
  getStatusLabel,
  onDelete,
}: ItemListMobileCardProps) {
  const roiPercent = item.roi || 0
  const roiDisplay = `${roiPercent >= 0 ? '+' : ''}${roiPercent.toFixed(1)}%`
  const icon = getCategoryIcon(item.category?.name)

  return (
    <article className="min-w-0 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className="mt-0.5 shrink-0 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
              <div className="min-w-0">
                <div className="font-semibold leading-snug break-words">{item.name}</div>
                {item.brand && item.model && (
                  <div className="text-sm text-muted-foreground">
                    {item.brand} {item.model}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <Badge variant={getStatusBadgeVariant(item.status)} className="shrink-0">
          {getStatusLabel(item.status)}
        </Badge>
      </div>

      <dl className="mt-3 grid gap-2 border-t border-border/60 pt-3 text-sm">
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-xs text-muted-foreground">品类</dt>
          <dd className="min-w-0 break-words">{item.category?.name || '-'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-xs text-muted-foreground">序列号</dt>
          <dd className="min-w-0">
            <code className="break-all rounded bg-muted px-2 py-0.5 text-xs">{item.serial_number || '未设置'}</code>
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <div>
            <span className="text-xs text-muted-foreground">成本 </span>
            <span className="tabular-nums">{formatCurrency(item.purchase_price)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">总收入 </span>
            <span className="tabular-nums">{formatCurrency(item.total_revenue || 0)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">净收益 </span>
            <span
              className={cn(
                'font-medium tabular-nums',
                (item.net_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {formatCurrency(item.net_profit || 0)}
            </span>
          </div>
        </div>
      </dl>

      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className={roiPercent >= 0 ? 'text-green-600' : 'text-red-600'}>{roiDisplay} ROI</span>
          <TrendingUp className={cn('h-4 w-4 shrink-0', roiPercent >= 0 ? 'text-green-600' : 'rotate-180 text-red-600')} />
        </div>
        <Progress value={Math.min(Math.max(roiPercent, 0), 100)} className="mt-2 h-2" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/items/${item.id}`}>查看</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(item)}
          aria-label="删除资产"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  )
}
