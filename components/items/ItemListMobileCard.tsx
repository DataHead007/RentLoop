'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { ItemWithStats } from '@/lib/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Trash2 } from 'lucide-react'
import { clampPaybackForBar, formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { ItemListRowContextBadges } from '@/components/items/ItemListSectionHeaders'
import { ItemListShortNameEditor } from '@/components/items/ItemListShortNameEditor'

type ItemListMobileCardProps = {
  item: ItemWithStats
  muted?: boolean
  familyLabel?: string
  showFamily?: boolean
  showCategory?: boolean
  showStatus?: boolean
  getCategoryIcon: (categoryName: string | undefined | null) => ReactNode
  getStatusBadgeVariant: (status: string) => 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | null | undefined
  getStatusLabel: (status: string) => string
  onDelete: (item: ItemWithStats) => void
  onShortNameSaved: (itemId: string, shortName: string | null) => void
}

export function ItemListMobileCard({
  item,
  muted,
  familyLabel,
  showFamily,
  showCategory,
  showStatus,
  getCategoryIcon,
  getStatusBadgeVariant,
  getStatusLabel,
  onDelete,
  onShortNameSaved,
}: ItemListMobileCardProps) {
  const paybackPct = item.payback_progress_pct ?? 0
  const paybackDisplay = `${paybackPct.toFixed(1)}%`
  const netProfit = item.net_profit || 0
  const icon = getCategoryIcon(item.category?.name)

  return (
    <article
      className={cn(
        'bg-white px-4 py-4',
        muted && 'opacity-80'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ItemListRowContextBadges
            familyLabel={familyLabel}
            categoryName={item.category?.name || '未分类'}
            statusLabel={getStatusLabel(item.status)}
            showFamily={showFamily}
            showCategory={showCategory}
            showStatus={showStatus}
            sold={muted}
          />
          <div className="flex items-start gap-2">
            {icon ? <span className="mt-0.5 shrink-0 opacity-70">{icon}</span> : null}
            <ItemListShortNameEditor
              itemId={item.id}
              fullName={item.name}
              shortName={item.short_name}
              subtitle={(() => {
                const parts = [item.brand, item.model].filter(Boolean).join(' ')
                if (!parts && !item.serial_number) return undefined
                return parts + (item.serial_number ? ` · ${item.serial_number}` : '')
              })()}
              onSaved={(shortName) => onShortNameSaved(item.id, shortName)}
              showDetailLink={false}
            />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={cn(
              'text-lg font-semibold tabular-nums tracking-tight',
              netProfit > 0 ? 'text-emerald-600' : netProfit < 0 ? 'text-red-600' : 'text-zinc-400'
            )}
          >
            {formatCurrency(netProfit)}
          </div>
          <p className="text-[10px] text-zinc-400">净收益</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
        <div>
          <span className="text-zinc-400">回本 </span>
          <span
            className={cn(
              'font-medium tabular-nums',
              paybackPct >= 100 ? 'text-emerald-600' : 'text-foreground'
            )}
          >
            {paybackDisplay}
          </span>
        </div>
        <div>
          <span className="text-zinc-400">成本 </span>
          <span className="tabular-nums">{formatCurrency(item.purchase_price)}</span>
        </div>
        <div>
          <span className="text-zinc-400">收入 </span>
          <span className="tabular-nums">{formatCurrency(item.total_revenue || 0)}</span>
        </div>
        <Badge variant={getStatusBadgeVariant(item.status)} className="h-5 text-[10px] font-normal">
          {getStatusLabel(item.status)}
        </Badge>
      </div>

      <Progress
        value={clampPaybackForBar(paybackPct)}
        className={cn('mt-2.5 h-1', paybackPct >= 100 && '[&>*]:bg-emerald-500')}
      />

      <div className="mt-3 flex gap-2">
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
          <Link href={`/items/${item.id}`}>详情</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-zinc-400 hover:text-destructive"
          onClick={() => onDelete(item)}
          aria-label="删除资产"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </article>
  )
}
