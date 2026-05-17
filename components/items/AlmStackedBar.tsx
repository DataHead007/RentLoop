'use client'

import { computeAlmStackSegments } from '@/lib/finance/almItemWaterfall'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

export type AlmStackedBarProps = {
  effectivePurchase: number
  unpaidLoan: number
  paybackRemaining: number
  paybackExcess: number
  /** 窄条：用于列表卡片 */
  compact?: boolean
  className?: string
}

const segClass: Record<string, string> = {
  debt: 'bg-red-600 dark:bg-red-500',
  own: 'bg-amber-400 dark:bg-amber-500',
  profit: 'bg-green-600 dark:bg-green-500',
}

export function AlmStackedBar({
  effectivePurchase,
  unpaidLoan,
  paybackRemaining,
  paybackExcess,
  compact,
  className,
}: AlmStackedBarProps) {
  if (!Number.isFinite(effectivePurchase) || effectivePurchase <= 0) return null

  const comp = computeAlmStackSegments({
    effectivePurchase,
    unpaidLoanPrincipal: unpaidLoan,
    paybackRemaining,
    paybackExcess,
  })

  const hasAny = comp.segments.length > 0 || comp.greenOverflowRatio > 1e-6
  if (!hasAny && comp.unpaidLoan < 0.01 && comp.yellowAmount < 0.01 && comp.pureProfitExcess < 0.01) {
    return null
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {!compact ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            <span className="inline-block h-2 w-2 rounded-sm bg-red-600 align-middle mr-1" /> 贷{' '}
            <span className="tabular-nums text-foreground">{formatCurrency(comp.unpaidLoan)}</span>
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-sm bg-amber-400 align-middle mr-1" /> 缺口{' '}
            <span className="tabular-nums text-foreground">{formatCurrency(comp.yellowAmount)}</span>
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-sm bg-green-600 align-middle mr-1" /> 超额{' '}
            <span className="tabular-nums text-foreground">{formatCurrency(comp.pureProfitExcess)}</span>
            {comp.greenOverflowRatio > 1e-3 ? (
              <span className="text-green-700 dark:text-green-400"> · 条外 +{(comp.greenOverflowRatio * 100).toFixed(0)}% 购置</span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          'flex w-full overflow-hidden rounded-full bg-muted',
          compact ? 'h-2' : 'h-2.5'
        )}
        title={`购置底 ${formatCurrency(comp.purchaseBase)}：红=剩余本金，黄=经营缺口示意，绿=超额`}
      >
        {comp.segments.map((s) => (
          <div
            key={s.key}
            className={cn('h-full shrink-0 transition-[width]', segClass[s.key])}
            style={{ width: `${Math.max(0, Math.min(1, s.widthInBar)) * 100}%` }}
          />
        ))}
        {comp.greenOverflowRatio > 1e-3 ? (
          <div
            className="h-full min-w-[4px] flex-1 bg-green-600/35 dark:bg-green-500/30"
            title={`纯利溢出约 ${(comp.greenOverflowRatio * 100).toFixed(0)}% 购置价`}
          />
        ) : null}
      </div>
    </div>
  )
}
