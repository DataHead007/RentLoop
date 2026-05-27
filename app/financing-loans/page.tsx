'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Landmark, Plus } from 'lucide-react'
import type { FinancingLoan } from '@/lib/types/database'
import { formatCurrency, formatDateShort } from '@/lib/utils/format'

export default function FinancingLoansPage() {
  const [loans, setLoans] = useState<FinancingLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/financing-loans')
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        if (!cancelled) setLoans(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="container mx-auto min-w-0 w-full max-w-5xl px-3 pt-3 pb-4 sm:px-4 md:px-6 md:pt-4 md:pb-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="h-6 w-6 shrink-0 text-muted-foreground sm:h-7 sm:w-7" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">购置融资</h1>
            <p className="text-sm text-muted-foreground sm:text-base">MVP：一笔借款对应一件资产；还款手动确认并记入交易支出</p>
          </div>
        </div>
        <Button asChild className="w-full shrink-0 sm:w-auto">
          <Link href="/financing-loans/new">
            <Plus className="mr-2 h-4 w-4" />
            新建融资
          </Link>
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">加载中…</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-destructive text-sm">
            {error}
            <p className="mt-2 text-muted-foreground">
              若表尚未创建，请在 Supabase 执行{' '}
              <code className="rounded bg-muted px-1">supabase/migration_financing_loans_mvp.sql</code>
            </p>
          </CardContent>
        </Card>
      ) : loans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无融资记录。可从「新建融资」绑定资产，或在资产详情页入口进入。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {loans.map((loan) => (
            <Link key={loan.id} href={`/financing-loans/${loan.id}`} className="block">
              <Card className="transition-colors hover:bg-accent/40">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      {loan.title || loan.item?.name || '未命名借款'}
                    </CardTitle>
                    <Badge variant={loan.status === 'active' ? 'default' : 'secondary'}>
                      {loan.status === 'active' ? '进行中' : '已结清'}
                    </Badge>
                  </div>
                  <CardDescription>
                    资产：{loan.item?.name || loan.item_id.slice(0, 8)}
                    {loan.item?.category?.name ? ` · ${loan.item.category.name}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span>
                    剩余本金 <span className="font-semibold tabular-nums">{formatCurrency(loan.principal_remaining)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    本金 {formatCurrency(loan.principal_total)} · 年化 {loan.annual_rate_percent}% · 每月
                    {loan.repayment_day_of_month} 号
                  </span>
                  <span className="text-muted-foreground">起息 {formatDateShort(loan.start_date)}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
