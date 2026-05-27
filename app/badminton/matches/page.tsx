'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trophy, Plus } from 'lucide-react'
import type { BadmintonMatchRecord } from '@/lib/types/database'
import { formatCurrency, formatDateShort } from '@/lib/utils/format'
import {
  computeBadmintonMatchNetProfit,
  matchNetProfitIncludesInKindEstimate,
} from '@/lib/badminton/matchNetProfit'
import { formatMatchDiscipline } from '@/lib/badminton/matchDisplay'
import { cn } from '@/lib/utils'

export default function BadmintonMatchesPage() {
  const [records, setRecords] = useState<BadmintonMatchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/badminton/matches')
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        if (!cancelled) setRecords(Array.isArray(data) ? data : [])
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

  const summary = useMemo(() => {
    const year = new Date().getFullYear()
    const thisYear = records.filter((r) => r.event_date.startsWith(String(year)))
    const totalNet = thisYear.reduce(
      (sum, r) =>
        sum +
        computeBadmintonMatchNetProfit({
          registration_fee: r.registration_fee,
          prize_mode: r.prize_mode,
          prize_cash: r.prize_cash,
          prize_in_kind_value: r.prize_in_kind_value,
        }),
      0
    )
    return { year, count: thisYear.length, totalNet }
  }, [records])

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Trophy className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">我的比赛</h1>
            <p className="text-sm text-muted-foreground">
              个人参赛记录 · 净利含奖品估值 · 保存后自动写入羽毛球交易
            </p>
          </div>
        </div>
        <Button asChild className="w-full shrink-0 sm:w-auto">
          <Link href="/badminton/matches/new">
            <Plus className="mr-2 h-4 w-4" />
            记一场比赛
          </Link>
        </Button>
      </div>

      {!loading && !error && records.length > 0 ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <Card className="shadow-none">
            <CardContent className="px-3 py-3 sm:px-4">
              <p className="text-xs text-muted-foreground">{summary.year} 年场次</p>
              <p className="text-lg font-semibold tabular-nums">{summary.count}</p>
            </CardContent>
          </Card>
          <Card className="col-span-1 shadow-none sm:col-span-2">
            <CardContent className="px-3 py-3 sm:px-4">
              <p className="text-xs text-muted-foreground">{summary.year} 年比赛净利合计</p>
              <p
                className={cn(
                  'text-lg font-semibold tabular-nums',
                  summary.totalNet >= 0 ? 'text-emerald-800' : 'text-rose-800'
                )}
              >
                {formatCurrency(summary.totalNet)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">加载中…</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-sm">
            <p className="text-destructive">{error}</p>
            <p className="mt-2 text-muted-foreground">
              若表尚未创建，请在 Supabase 执行{' '}
              <code className="rounded bg-muted px-1 text-xs">
                supabase/migration_badminton_match_records.sql
              </code>
            </p>
          </CardContent>
        </Card>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            还没有比赛记录。点击「记一场比赛」开始。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {records.map((record) => {
            const net = computeBadmintonMatchNetProfit({
              registration_fee: record.registration_fee,
              prize_mode: record.prize_mode,
              prize_cash: record.prize_cash,
              prize_in_kind_value: record.prize_in_kind_value,
            })
            const inKind = matchNetProfitIncludesInKindEstimate(record.prize_mode)
            return (
              <Link key={record.id} href={`/badminton/matches/${record.id}`} className="block">
                <Card className="shadow-none transition-colors hover:bg-muted/40">
                  <CardHeader className="gap-1 p-3 pb-1 sm:p-4 sm:pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{record.event_name}</CardTitle>
                      <span
                        className={cn(
                          'shrink-0 text-sm font-semibold tabular-nums',
                          net >= 0 ? 'text-emerald-800' : 'text-rose-800'
                        )}
                      >
                        {formatCurrency(net)}
                      </span>
                    </div>
                    <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>{formatDateShort(record.event_date)}</span>
                      <span>·</span>
                      <span>{record.location}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
                    <Badge variant="secondary">{formatMatchDiscipline(record)}</Badge>
                    {record.result?.trim() ? (
                      <Badge variant="outline">{record.result}</Badge>
                    ) : null}
                    {inKind ? (
                      <span className="text-xs text-muted-foreground">含奖品估值</span>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
