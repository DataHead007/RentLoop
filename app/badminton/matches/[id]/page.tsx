'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import type { BadmintonMatchRecord, Transaction } from '@/lib/types/database'
import { formatCurrency, formatDateShort } from '@/lib/utils/format'
import {
  computeBadmintonMatchNetProfit,
  matchNetProfitIncludesInKindEstimate,
} from '@/lib/badminton/matchNetProfit'
import { formatMatchDiscipline, formatPrizeModeLabel } from '@/lib/badminton/matchDisplay'
import { BadmintonMatchForm } from '@/components/badminton/BadmintonMatchForm'
import { cn } from '@/lib/utils'

export default function BadmintonMatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [record, setRecord] = useState<BadmintonMatchRecord | null>(null)
  const [linkedTransactions, setLinkedTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/badminton/matches/${id}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const { linked_transactions, ...match } = data
      setRecord(match as BadmintonMatchRecord)
      setLinkedTransactions(Array.isArray(linked_transactions) ? linked_transactions : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      setRecord(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleResyncTransactions() {
    setSyncing(true)
    try {
      const res = await fetch(`/api/badminton/matches/${id}/sync-transactions`, { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || '同步失败')
      }
      const j = await res.json()
      await load()
      alert(`已同步 ${j.transactions_synced ?? 0} 笔交易`)
    } catch (e) {
      alert(e instanceof Error ? e.message : '同步失败')
    } finally {
      setSyncing(false)
    }
  }

  async function handleDelete() {
    if (!confirm('确定删除这条比赛记录？此操作不可恢复。')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/badminton/matches/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || '删除失败')
      }
      router.push('/badminton/matches')
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="mx-auto max-w-2xl text-center text-sm">
        <p className="text-destructive">{error || '记录不存在'}</p>
        <Button variant="link" asChild className="mt-2">
          <Link href="/badminton/matches">返回列表</Link>
        </Button>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-4">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:underline"
            onClick={() => setEditing(false)}
          >
            ← 取消编辑
          </button>
          <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">编辑比赛</h1>
        </div>
        <BadmintonMatchForm matchId={id} initialRecord={record} />
      </div>
    )
  }

  const net = computeBadmintonMatchNetProfit({
    registration_fee: record.registration_fee,
    prize_mode: record.prize_mode,
    prize_cash: record.prize_cash,
    prize_in_kind_value: record.prize_in_kind_value,
  })
  const inKind = matchNetProfitIncludesInKindEstimate(record.prize_mode)

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4">
        <Link href="/badminton/matches" className="text-sm text-muted-foreground hover:underline">
          ← 返回我的比赛
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{record.event_name}</h1>
            <p className="text-sm text-muted-foreground">
              {formatDateShort(record.event_date)}
              {record.event_time ? ` ${record.event_time.slice(0, 5)}` : ''}
              {' · '}
              {record.location}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              编辑
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-4 w-4" />
              )}
              删除
            </Button>
          </div>
        </div>
      </div>

      <Card className="mb-4 shadow-none">
        <CardContent className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">本场净利</p>
            {inKind ? (
              <p className="text-xs text-muted-foreground">含奖品主观估值</p>
            ) : null}
          </div>
          <p
            className={cn(
              'text-2xl font-semibold tabular-nums',
              net >= 0 ? 'text-emerald-800' : 'text-rose-800'
            )}
          >
            {formatCurrency(net)}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">竞技</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{formatMatchDiscipline(record)}</Badge>
              {record.result?.trim() ? <Badge variant="outline">{record.result}</Badge> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">收支</CardTitle>
            <CardDescription>{formatPrizeModeLabel(record.prize_mode)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="报名费" value={formatCurrency(record.registration_fee)} />
            {(record.prize_mode === 'cash' || record.prize_mode === 'both') &&
            record.prize_cash != null ? (
              <Row label="现金奖金" value={formatCurrency(record.prize_cash)} />
            ) : null}
            {(record.prize_mode === 'in_kind' || record.prize_mode === 'both') &&
            record.prize_in_kind_desc ? (
              <>
                <Row label="奖品" value={record.prize_in_kind_desc} />
                {record.prize_in_kind_value != null ? (
                  <Row label="奖品估值" value={formatCurrency(record.prize_in_kind_value)} />
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>

        {record.reflection?.trim() ? (
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">比赛心得</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {record.reflection}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">羽毛球交易</CardTitle>
            <CardDescription>
              {linkedTransactions.length > 0
                ? '由本比赛自动同步，修改比赛后保存会重新生成'
                : '暂无关联交易（可能尚未同步或金额为 0）'}
            </CardDescription>
          </CardHeader>
          <CardContent className={cn('space-y-2', linkedTransactions.length === 0 && 'pt-0')}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncing}
              onClick={handleResyncTransactions}
            >
              {syncing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              重新同步交易
            </Button>
          {linkedTransactions.length > 0 ? (
            <>
              {linkedTransactions.map((tx) => (
                <Link
                  key={tx.id}
                  href={`/transactions/${tx.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0 truncate text-muted-foreground">
                    {tx.category}
                    {tx.description ? ` · ${tx.description}` : ''}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 font-medium tabular-nums',
                      tx.type === 'income' ? 'text-emerald-800' : 'text-rose-800'
                    )}
                  >
                    {formatCurrency(Math.abs(Number(tx.amount)))}
                  </span>
                </Link>
              ))}
              <Button variant="link" size="sm" className="h-auto px-0" asChild>
                <Link href="/badminton/transactions">查看全部羽毛球交易 →</Link>
              </Button>
            </>
          ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
