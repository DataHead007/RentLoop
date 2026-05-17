'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ItemWithStats } from '@/lib/types/database'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'

function NewFinancingLoanForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const presetItemId = searchParams.get('itemId') || ''

  const [items, setItems] = useState<ItemWithStats[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [item_id, setItem_id] = useState(presetItemId)
  const [title, setTitle] = useState('')
  const [principal_total, setPrincipal_total] = useState('')
  const [annual_rate_percent, setAnnual_rate_percent] = useState('')
  const [repayment_day_of_month, setRepayment_day_of_month] = useState('10')
  const [start_date, setStart_date] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/items', { cache: 'no-store' })
        if (!res.ok) throw new Error('加载资产失败')
        const data = await res.json()
        setItems(Array.isArray(data) ? data : [])
      } catch {
        setItems([])
      } finally {
        setLoadingItems(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (presetItemId) setItem_id(presetItemId)
  }, [presetItemId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const p = parseFloat(principal_total)
    const r = parseFloat(annual_rate_percent)
    const day = parseInt(repayment_day_of_month, 10)
    if (!item_id) {
      alert('请选择资产')
      return
    }
    if (!Number.isFinite(p) || p <= 0) {
      alert('请输入有效的借款本金')
      return
    }
    if (!Number.isFinite(r) || r < 0) {
      alert('请输入有效的年化利率（%）')
      return
    }
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      alert('还款日须为 1–28 的整数')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/financing-loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id,
          title: title.trim() || null,
          principal_total: p,
          annual_rate_percent: r,
          repayment_day_of_month: day,
          start_date: start_date.trim(),
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : '创建失败')
      }
      router.push(`/financing-loans/${data.id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto min-w-0 w-full max-w-2xl px-3 py-4 sm:px-4 md:px-6 md:py-8">
      <div className="mb-6">
        <Link href="/financing-loans" className="text-sm text-muted-foreground hover:underline">
          ← 返回列表
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">新建购置融资</h1>
        <p className="text-sm text-muted-foreground sm:text-base">与单件资产 1:1；后续在详情页按银行账单填写利息/还本并确认</p>
      </div>

      <form onSubmit={handleSubmit} className="min-w-0 space-y-5 sm:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>借款信息</CardTitle>
            <CardDescription>
              年化与还款日仅作记录；实际利息以你确认的还款金额为准（MVP）。借款本金为<strong>贷款部分</strong>，须不超过该资产购买总价；新建资产时可在「自有资金 + 贷款」中拆分填写。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label>关联资产 *</Label>
              <Select value={item_id || undefined} onValueChange={setItem_id} disabled={loadingItems}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingItems ? '加载资产…' : '选择资产'} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.name}
                      {it.category?.name ? `（${it.category.name}）` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">借款名称（可选）</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="如：招行信用贷-S5M2"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="principal">借款本金 (¥) *</Label>
                <Input
                  id="principal"
                  type="number"
                  step="0.01"
                  min="0"
                  value={principal_total}
                  onChange={(e) => setPrincipal_total(e.target.value)}
                  placeholder="与银行放款一致"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate">年化利率 (%) *</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={annual_rate_percent}
                  onChange={(e) => setAnnual_rate_percent(e.target.value)}
                  placeholder="如 4.35"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="day">每月还款日 *</Label>
                <Input
                  id="day"
                  type="number"
                  min={1}
                  max={28}
                  value={repayment_day_of_month}
                  onChange={(e) => setRepayment_day_of_month(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">建议 1–28，避免部分月份无对应日期</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">起息日 *</Label>
                <Input id="start" type="date" value={start_date} onChange={(e) => setStart_date(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">备注</Label>
              <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="可选" />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="w-full sm:w-auto" asChild>
            <Link href="/financing-loans">取消</Link>
          </Button>
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function NewFinancingLoanPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-3 py-10 text-center text-muted-foreground sm:px-4">加载中…</div>
      }
    >
      <NewFinancingLoanForm />
    </Suspense>
  )
}
