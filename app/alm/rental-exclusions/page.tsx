'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/format'
import { ArrowLeft } from 'lucide-react'

type Row = {
  id: string
  transaction_date: string
  type: 'income' | 'expense'
  category: string | null
  amount: number
  description: string | null
  item_id: string | null
  order_id: string | null
  excludeReason: 'empty_category' | 'category_not_whitelisted'
}

type Payload = {
  count: number
  byCategory: { category: string; count: number; signedTotal: number }[]
  rows: Row[]
  excludedSignedTotal: number
  whitelists: {
    income: readonly string[]
    expense: readonly string[]
    excludedIncomeByPolicy: readonly string[]
  }
}

function reasonLabel(r: Row['excludeReason']): string {
  if (r === 'empty_category') return '无类目'
  return '类目不在白名单'
}

export default function RentalAlmExclusionsPage() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/alm/rental-exclusions', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : '加载失败')
        if (!cancelled && json.success && json.data) setData(json.data as Payload)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="container mx-auto min-w-0 max-w-6xl px-3 py-4 sm:px-4 md:px-6 md:py-8">
      <Link
        href="/transactions"
        className="mb-4 inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回交易记录
      </Link>

      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">租赁 · 未计入全局池的流水</h1>
      <p className="mt-1 text-sm text-muted-foreground sm:text-base">
        以下为 <code className="rounded bg-muted px-1">business_plate = rental</code> 且<strong>无类目</strong>或
        <strong>类目不在 ALM 白名单</strong>的交易；这些金额<strong>不会</strong>进入顶部「租赁 · 全局可用资金」。
      </p>

      {error ? (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      ) : !data ? (
        <p className="mt-4 text-sm text-muted-foreground">加载中…</p>
      ) : (
        <div className="mt-6 space-y-5 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>汇总</CardTitle>
              <CardDescription>
                共 <strong>{data.count}</strong> 笔；未计入部分带符号合计{' '}
                <strong className="tabular-nums">{formatCurrency(data.excludedSignedTotal)}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-muted-foreground">按类目聚合（便于一眼看出问题类目）</p>
              <div className="mt-3 space-y-2 sm:hidden">
                {data.byCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">无未计入流水</p>
                ) : (
                  data.byCategory.map((b) => (
                    <div
                      key={b.category}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card p-3 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium">{b.category}</span>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">{b.count} 笔</p>
                        <p
                          className={`font-semibold tabular-nums ${
                            b.signedTotal >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(b.signedTotal)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>类目</TableHead>
                      <TableHead className="text-right">笔数</TableHead>
                      <TableHead className="text-right">带符号合计</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byCategory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground">
                          无未计入流水
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.byCategory.map((b) => (
                        <TableRow key={b.category}>
                          <TableCell className="font-medium">{b.category}</TableCell>
                          <TableCell className="text-right tabular-nums">{b.count}</TableCell>
                          <TableCell
                            className={`text-right font-medium tabular-nums ${
                              b.signedTotal >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(b.signedTotal)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>当前白名单（命中才计入全局池）</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                收入（不含政策排除）：{data.whitelists.income.join('、')}。政策排除收入：{' '}
                {data.whitelists.excludedIncomeByPolicy.join('、')}。支出：{data.whitelists.expense.join('、')}。
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>明细</CardTitle>
              <CardDescription>按日期倒序</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <div className="space-y-3 lg:hidden">
                {data.rows.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-border/60 bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="tabular-nums text-sm font-medium">{r.transaction_date}</p>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{r.category || '—'}</p>
                      </div>
                      <Badge variant={r.type === 'income' ? 'default' : 'secondary'} className="shrink-0">
                        {r.type === 'income' ? '收入' : '支出'}
                      </Badge>
                    </div>
                    <p
                      className={`mt-2 text-lg font-semibold tabular-nums ${
                        r.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(r.amount)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{reasonLabel(r.excludeReason)}</p>
                    {r.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
                    ) : null}
                    <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                      <Link href={`/transactions/${r.id}/edit`}>编辑</Link>
                    </Button>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>类目</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead>原因</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap tabular-nums">{r.transaction_date}</TableCell>
                        <TableCell>
                          <Badge variant={r.type === 'income' ? 'default' : 'secondary'}>
                            {r.type === 'income' ? '收入' : '支出'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[10rem] truncate">{r.category || '—'}</TableCell>
                        <TableCell
                          className={`text-right font-medium tabular-nums ${
                            r.amount >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(r.amount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{reasonLabel(r.excludeReason)}</TableCell>
                        <TableCell className="max-w-[14rem] truncate text-sm" title={r.description || ''}>
                          {r.description || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/transactions/${r.id}/edit`} className="text-sm text-primary hover:underline">
                            编辑
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
