'use client'

import Link from 'next/link'
import type { BusinessLine, Transaction } from '@/lib/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Sparkles, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { formatCurrency, formatDateShort } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

const BUSINESS_LINE_LABEL: Record<BusinessLine, string> = {
  rental: '租赁',
  badminton: '羽毛球',
  youtube: 'YouTube',
  wechat_video: '视频号',
}

type TransactionListMobileCardProps = {
  transaction: Transaction
  onDelete: (transaction: Transaction) => void
}

export function TransactionListMobileCard({ transaction, onDelete }: TransactionListMobileCardProps) {
  const isIncome = transaction.type === 'income'

  return (
    <article className="min-w-0 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isIncome ? 'success' : 'destructive'}>
          {isIncome ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
          {isIncome ? '收入' : '支出'}
        </Badge>
        {transaction.auto_created && (
          <Badge variant="outline" className="text-xs">
            <Sparkles className="mr-1 h-3 w-3" />
            自动
          </Badge>
        )}
      </div>

      <div
        className={cn(
          'mt-3 text-xl font-semibold tabular-nums tracking-tight',
          isIncome ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
        )}
      >
        {formatCurrency(transaction.amount)}
      </div>

      <dl className="mt-3 min-w-0 space-y-2 border-t border-border/60 pt-3 text-sm">
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-xs font-medium text-muted-foreground">类别</dt>
          <dd className="min-w-0 break-words font-medium">{transaction.category || '-'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-xs font-medium text-muted-foreground">描述</dt>
          <dd className="min-w-0 break-words text-muted-foreground">{transaction.description || '-'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-xs font-medium text-muted-foreground">日期</dt>
          <dd className="min-w-0">{formatDateShort(transaction.transaction_date)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-xs font-medium text-muted-foreground">来源</dt>
          <dd className="min-w-0 break-all">
            {transaction.order_id ? (
              <Link href={`/orders/${transaction.order_id}`} className="text-primary underline-offset-2 hover:underline">
                订单 {transaction.order_id.slice(0, 8)}…
              </Link>
            ) : (
              <span className="text-muted-foreground">手动创建</span>
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-xs font-medium text-muted-foreground">业务</dt>
          <dd className="text-muted-foreground">{BUSINESS_LINE_LABEL[transaction.business_line] ?? transaction.business_line}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link href={`/transactions/${transaction.id}/edit`}>
            <Edit className="mr-1 h-4 w-4" />
            编辑
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(transaction)}
          aria-label="删除交易"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  )
}
