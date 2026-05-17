'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { Zap } from 'lucide-react'

type AlmSummaryPayload = {
  businessLineScope?: 'rental'
  globalBalance: number
  computedAt: string
  includedTransactionCount: number
  excludedTransactionCount: number
  activeFinancingCount: number
  totalPrincipalRemaining: number
  suggestRepayment: boolean
  suggestRepaymentMinBalance: number
  policy: { note: string; excludedIncomeCategories: readonly string[] }
}

export function AlmGlobalBar() {
  const [data, setData] = useState<AlmSummaryPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/alm/summary', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(typeof json.error === 'string' ? json.error : '加载失败')
        }
        if (!cancelled && json.success && json.data) {
          setData(json.data as AlmSummaryPayload)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '加载失败')
          setData(null)
        }
      }
    }
    load()
    const id = setInterval(load, 60000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (error && !data) {
    return (
      <div className="border-b border-border/40 bg-muted/20 px-4 py-1.5 text-center text-[11px] text-muted-foreground md:px-6">
        全局资金条暂不可用：{error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="border-b border-border/40 bg-muted/15 px-4 py-1.5 text-center text-[11px] text-muted-foreground md:px-6">
        正在加载全局资金…
      </div>
    )
  }

  return (
    <div className="border-b border-border/40 bg-muted/15">
      <div className="container flex flex-col gap-1.5 px-4 py-1.5 text-xs md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-4 md:gap-y-0 md:px-6">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="shrink-0 text-muted-foreground">租赁 · 全局可用资金</span>
          <span className="text-sm font-semibold tabular-nums tracking-tight text-foreground">
            {formatCurrency(data.globalBalance)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            仅租赁流水 · 已计入 {data.includedTransactionCount} 笔
            {data.excludedTransactionCount > 0 ? (
              <>
                {' · '}
                <Link
                  href="/alm/rental-exclusions"
                  className="text-foreground/80 underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
                >
                  未计入 {data.excludedTransactionCount} 笔
                </Link>
                <span>（无类目或不在白名单）</span>
              </>
            ) : null}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {data.activeFinancingCount > 0 ? (
            <span>
              进行中融资 {data.activeFinancingCount} 笔 · 剩余本金{' '}
              <span className="tabular-nums text-foreground">{formatCurrency(data.totalPrincipalRemaining)}</span>
            </span>
          ) : (
            <span>当前无进行中融资</span>
          )}
          <Link
            href="/transactions"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            交易记录
          </Link>
          <Link
            href="/financing-loans"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            购置融资
          </Link>
        </div>
      </div>

      {data.suggestRepayment ? (
        <div
          className={cn(
            'flex flex-col gap-2 border-t border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-950 md:flex-row md:items-center md:justify-between md:px-6',
            'dark:text-amber-50'
          )}
        >
          <div className="flex min-w-0 items-start gap-2">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
            <p className="min-w-0 leading-snug">
              租赁池可用资金已达 <strong className="tabular-nums">{formatCurrency(data.suggestRepaymentMinBalance)}</strong>
              ，且仍有未结清购置融资。建议尽快在「购置融资」中发起<strong>归还本金</strong>（记法 A：租金不会自动减少剩余本金）。羽毛球与自媒体为单独核算，不计入本提示所依据的余额。
            </p>
          </div>
          <Link
            href="/financing-loans"
            className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400"
          >
            去还款
          </Link>
        </div>
      ) : null}
    </div>
  )
}
