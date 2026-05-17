'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { FinancingLoan, FinancingLoanPayment } from '@/lib/types/database'
import { formatCurrency, formatDateShort } from '@/lib/utils/format'
import { format } from 'date-fns'
import { Loader2, Trash2 } from 'lucide-react'

type LoanDetail = FinancingLoan & { payments: FinancingLoanPayment[] }

export default function FinancingLoanDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loan, setLoan] = useState<LoanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingLoan, setDeletingLoan] = useState(false)

  const [payment_date, setPayment_date] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [interest_amount, setInterest_amount] = useState('')
  const [principal_amount, setPrincipal_amount] = useState('')
  const [payNote, setPayNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/financing-loans/${id}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setLoan(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      setLoan(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault()
    const i = parseFloat(interest_amount || '0')
    const p = parseFloat(principal_amount || '0')
    if ((!Number.isFinite(i) || i <= 0) && (!Number.isFinite(p) || p <= 0)) {
      alert('请填写本期利息和/或归还本金（大于 0）')
      return
    }
    if (Number.isFinite(i) && i < 0) return alert('利息不能为负')
    if (Number.isFinite(p) && p < 0) return alert('本金不能为负')

    setSubmitting(true)
    try {
      const res = await fetch(`/api/financing-loans/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_date: payment_date.trim(),
          interest_amount: Number.isFinite(i) && i > 0 ? i : 0,
          principal_amount: Number.isFinite(p) && p > 0 ? p : 0,
          note: payNote.trim() || null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : '记录失败')

      setInterest_amount('')
      setPrincipal_amount('')
      setPayNote('')
      await load()
      window.dispatchEvent(new CustomEvent('transactionUpdated'))
      localStorage.setItem('transactionUpdated', Date.now().toString())
      if (j.status === 'closed') {
        alert('本金已还清，融资已自动结清。')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '记录失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteLoan() {
    const ok = window.confirm('确认删除这笔融资吗？\n将同时删除该融资的还款记录，以及关联的融资交易（利息/还本/放款入账）。')
    if (!ok) return
    setDeletingLoan(true)
    try {
      const res = await fetch(`/api/financing-loans/${id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof j.error === 'string' ? j.error : '删除失败')
      }
      window.dispatchEvent(new CustomEvent('transactionUpdated'))
      localStorage.setItem('transactionUpdated', Date.now().toString())
      alert('融资记录已删除')
      router.push('/financing-loans')
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingLoan(false)
    }
  }

  if (loading && !loan) {
    return (
      <div className="container mx-auto px-3 py-12 text-center text-muted-foreground sm:px-4">
        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
        加载中…
      </div>
    )
  }

  if (error || !loan) {
    return (
      <div className="container mx-auto max-w-2xl px-3 py-12 text-center sm:px-4">
        <p className="text-destructive">{error || '未找到记录'}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/financing-loans">返回列表</Link>
        </Button>
      </div>
    )
  }

  const payments = loan.payments || []

  return (
    <div className="container mx-auto min-w-0 w-full max-w-4xl space-y-5 px-3 py-4 sm:px-4 md:space-y-6 md:px-6 md:py-8">
      <div>
        <Link href="/financing-loans" className="text-sm text-muted-foreground hover:underline">
          ← 返回列表
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {loan.title || loan.item?.name || '融资详情'}
          </h1>
          <Badge variant={loan.status === 'active' ? 'default' : 'secondary'}>
            {loan.status === 'active' ? '进行中' : '已结清'}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          资产：
          {loan.item ? (
            <Link href={`/items/${loan.item_id}`} className="text-primary underline-offset-2 hover:underline">
              {loan.item.name}
            </Link>
          ) : (
            loan.item_id
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>合同概要</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            借款本金 <span className="font-semibold tabular-nums">{formatCurrency(loan.principal_total)}</span>
          </div>
          <div>
            剩余本金{' '}
            <span className="font-semibold tabular-nums">{formatCurrency(loan.principal_remaining)}</span>
          </div>
          <div>年化利率 {loan.annual_rate_percent}%</div>
          <div>
            每月还款日 {loan.repayment_day_of_month} 号 · 起息 {formatDateShort(loan.start_date)}
          </div>
          {loan.notes && (
            <div className="sm:col-span-2 text-muted-foreground">备注：{loan.notes}</div>
          )}
        </CardContent>
      </Card>

      {loan.status === 'active' && (
        <Card>
          <CardHeader>
            <CardTitle>确认还款</CardTitle>
            <CardDescription>
              按银行账单填写金额；将分别生成支出类别「融资成本」「归还借款本金」并关联该资产
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePayment} className="min-w-0 space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pdate">还款日期 *</Label>
                <Input id="pdate" type="date" value={payment_date} onChange={(e) => setPayment_date(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="int">本期利息 (¥)</Label>
                  <Input
                    id="int"
                    type="number"
                    step="0.01"
                    min="0"
                    value={interest_amount}
                    onChange={(e) => setInterest_amount(e.target.value)}
                    placeholder="无则留空或 0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pri">归还本金 (¥)</Label>
                  <Input
                    id="pri"
                    type="number"
                    step="0.01"
                    min="0"
                    value={principal_amount}
                    onChange={(e) => setPrincipal_amount(e.target.value)}
                    placeholder="无则留空或 0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pnote">备注（可选）</Label>
                <Textarea id="pnote" rows={2} value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              </div>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认并记入交易
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>还款记录</CardTitle>
          <CardDescription>已确认的还款及关联交易</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 px-2 sm:px-6">
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无记录</p>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {payments.map((p) => (
                  <div key={p.id} className="rounded-lg border p-3 text-sm">
                    <div className="font-medium">{formatDateShort(p.payment_date)}</div>
                    {p.interest_amount > 0 && (
                      <div className="mt-1 text-muted-foreground">
                        利息 {formatCurrency(p.interest_amount)}
                        {p.interest_transaction_id && (
                          <Link
                            href={`/transactions/${p.interest_transaction_id}/edit`}
                            className="ml-2 text-xs text-primary underline"
                          >
                            交易
                          </Link>
                        )}
                      </div>
                    )}
                    {p.principal_amount > 0 && (
                      <div className="text-muted-foreground">
                        本金 {formatCurrency(p.principal_amount)}
                        {p.principal_transaction_id && (
                          <Link
                            href={`/transactions/${p.principal_transaction_id}/edit`}
                            className="ml-2 text-xs text-primary underline"
                          >
                            交易
                          </Link>
                        )}
                      </div>
                    )}
                    {p.note && <div className="mt-1 text-xs">{p.note}</div>}
                  </div>
                ))}
              </div>
              <div className="hidden min-w-0 lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>利息</TableHead>
                      <TableHead>本金</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDateShort(p.payment_date)}</TableCell>
                        <TableCell>
                          {p.interest_amount > 0 ? (
                            <span>
                              {formatCurrency(p.interest_amount)}
                              {p.interest_transaction_id && (
                                <Link
                                  href={`/transactions/${p.interest_transaction_id}/edit`}
                                  className="ml-2 text-xs text-primary"
                                >
                                  编辑
                                </Link>
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {p.principal_amount > 0 ? (
                            <span>
                              {formatCurrency(p.principal_amount)}
                              {p.principal_transaction_id && (
                                <Link
                                  href={`/transactions/${p.principal_transaction_id}/edit`}
                                  className="ml-2 text-xs text-primary"
                                >
                                  编辑
                                </Link>
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.note || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href={`/transactions/new?itemId=${loan.item_id}`}>为该资产记一笔交易</Link>
        </Button>
        <Button variant="outline" onClick={() => router.push(`/items/${loan.item_id}`)}>
          打开资产详情
        </Button>
        <Button
          variant="destructive"
          onClick={handleDeleteLoan}
          disabled={deletingLoan}
          className="ml-auto"
        >
          {deletingLoan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          删除融资
        </Button>
      </div>
    </div>
  )
}
