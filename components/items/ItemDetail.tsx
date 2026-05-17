'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Package, DollarSign, Calendar as CalendarIcon, Hash, Edit, FileText, ExternalLink, Plus, TrendingUp, Trash2, Wrench, Landmark, Clock, CircleAlert, TriangleAlert } from 'lucide-react'
import type { FinancingLoan, ItemWithStats, Transaction } from '@/lib/types/database'
import { clampPaybackForBar, formatCurrency, formatDateShort, formatOwnershipDuration } from '@/lib/utils/format'
import { getPostSaleLiquidationAlert, isItemLiquidated } from '@/lib/finance/liquidationAlerts'
import { AlmStackedBar } from '@/components/items/AlmStackedBar'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { format } from 'date-fns'

export function ItemDetail() {
  const params = useParams()
  const router = useRouter()
  const itemId = params.id as string
  const [item, setItem] = useState<ItemWithStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState({
    amount: '',
    description: '',
    transaction_date: format(new Date(), 'yyyy-MM-dd'),
  })
  const [submittingMaintenance, setSubmittingMaintenance] = useState(false)
  const [activeFinancingLoan, setActiveFinancingLoan] = useState<FinancingLoan | null>(null)

  const liquidationAlert = useMemo(() => {
    if (!item) return null
    return getPostSaleLiquidationAlert({
      liquidated: isItemLiquidated(item),
      effectivePurchase: item.effective_purchase_cost ?? 0,
      financingPrincipalRemaining: item.financing_principal_remaining ?? 0,
      paybackRemaining: item.payback_remaining ?? 0,
      paybackExcess: item.payback_excess_amount ?? 0,
    })
  }, [item])

  useEffect(() => {
    loadItem()
    loadTransactions()
  }, [itemId])

  useEffect(() => {
    if (!itemId) return
    let cancelled = false
    fetch(`/api/financing-loans?itemId=${itemId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: FinancingLoan[]) => {
        if (cancelled || !Array.isArray(rows)) return
        setActiveFinancingLoan(rows.find((l) => l.status === 'active') ?? null)
      })
      .catch(() => {
        if (!cancelled) setActiveFinancingLoan(null)
      })
    return () => {
      cancelled = true
    }
  }, [itemId])

  async function loadItem() {
    try {
      setLoading(true)
      const response = await fetch(`/api/items/${itemId}`)
      if (!response.ok) throw new Error('Failed to fetch item')
      const data = await response.json()
      setItem(data)
    } catch (error) {
      console.error('Failed to load item:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadTransactions() {
    try {
      const response = await fetch(`/api/transactions?itemId=${itemId}`)
      if (!response.ok) return
      const data = await response.json()
      setTransactions(data)
    } catch (error) {
      console.error('Failed to load transactions:', error)
    }
  }

  async function handleDeleteTransaction() {
    if (!transactionToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/transactions?id=${transactionToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '删除失败')
      }

      // 重新加载数据
      await loadTransactions()
      await loadItem()
      setDeleteDialogOpen(false)
      setTransactionToDelete(null)
    } catch (error) {
      console.error('Failed to delete transaction:', error)
      alert(error instanceof Error ? error.message : '删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSubmitMaintenance(e: React.FormEvent) {
    e.preventDefault()
    
    if (!maintenanceForm.amount || parseFloat(maintenanceForm.amount) <= 0) {
      alert('请输入有效的维护费用金额')
      return
    }

    setSubmittingMaintenance(true)
    try {
      // 金额转为负数（支出）
      const amount = -Math.abs(parseFloat(maintenanceForm.amount))
      
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          order_id: null,
          type: 'expense',
          amount: amount,
          category: '维护费用',
          description: maintenanceForm.description || '设备维护',
          transaction_date: maintenanceForm.transaction_date,
          auto_created: false,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '创建维护记录失败')
      }

      // 刷新数据
      await loadTransactions()
      await loadItem()
      
      // 重置表单并关闭对话框
      setMaintenanceForm({
        amount: '',
        description: '',
        transaction_date: format(new Date(), 'yyyy-MM-dd'),
      })
      setMaintenanceDialogOpen(false)
      
      alert('维护记录已添加')
    } catch (error) {
      console.error('Failed to create maintenance record:', error)
      alert(error instanceof Error ? error.message : '添加维护记录失败，请重试')
    } finally {
      setSubmittingMaintenance(false)
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'available':
        return 'success'
      case 'rented':
        return 'default'
      case 'in_use':
        return 'default'
      case 'maintenance':
        return 'warning'
      case 'retired':
        return 'secondary'
      case 'sold':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      available: '可用',
      rented: '出租中',
      in_use: '使用中',
      maintenance: '维护中',
      retired: '已退役',
      sold: '已售出',
    }
    return labels[status] || status
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    )
  }

  if (!item) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-muted-foreground">资产不存在</p>
            <Button onClick={() => router.push('/items')} className="mt-4">
              返回资产列表
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              // 如果资产有品类，跳转到该品类的资产列表页
              if (item.category?.name) {
                router.push(`/items?category=${encodeURIComponent(item.category.name)}`)
              } else {
                router.push('/items')
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{item.name}</h2>
            {item.brand && item.model && (
              <p className="text-sm text-muted-foreground sm:text-base">{item.brand} {item.model}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => router.push(`/items/${item.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => router.push('/items/new')}>
            <Plus className="mr-2 h-4 w-4" />
            继续新增资产
          </Button>
          <Badge variant={getStatusBadgeVariant(item.status)}>
            {getStatusLabel(item.status)}
          </Badge>
        </div>
      </div>

      {activeFinancingLoan ? (
        <Card className="border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4" />
              购置融资（进行中）
            </CardTitle>
            <CardDescription>
              剩余本金 {formatCurrency(activeFinancingLoan.principal_remaining)} · 年化 {activeFinancingLoan.annual_rate_percent}% · 每月
              {activeFinancingLoan.repayment_day_of_month} 号
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/financing-loans/${activeFinancingLoan.id}`}>查看 / 记录还款</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-muted-foreground">购置融资</CardTitle>
            <CardDescription>若本资产为借款购入，可登记融资并在还款时自动生成交易支出</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/financing-loans/new?itemId=${itemId}`}>登记购置融资</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {liquidationAlert ? (
        <Alert
          variant={liquidationAlert.level === 'red' ? 'destructive' : 'default'}
          className={
            liquidationAlert.level === 'yellow'
              ? 'border-amber-500/40 bg-amber-50/80 text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/30 dark:text-amber-50 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-400'
              : undefined
          }
        >
          {liquidationAlert.level === 'red' ? (
            <CircleAlert className="h-4 w-4" />
          ) : (
            <TriangleAlert className="h-4 w-4" />
          )}
          <AlertTitle>
            {liquidationAlert.level === 'red' ? '售出后仍有未清偿融资本金' : '售出后：融资已清，经营口径仍有自有缺口'}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            {liquidationAlert.level === 'red' ? (
              <>
                <p>
                  进行中融资剩余本金{' '}
                  <span className="font-semibold tabular-nums">{formatCurrency(liquidationAlert.debtRemaining)}</span>
                  。变卖收入<strong>不会</strong>自动冲减负债，请在融资详情中登记还本，或核对融资状态。
                </p>
                <Button variant="outline" size="sm" asChild className="mt-1 border-destructive/40">
                  <Link href={activeFinancingLoan ? `/financing-loans/${activeFinancingLoan.id}` : '/financing-loans'}>
                    {activeFinancingLoan ? '打开本资产融资' : '前往融资列表'}
                  </Link>
                </Button>
              </>
            ) : (
              <p>
                ALM 黄段对应金额约{' '}
                <span className="font-semibold tabular-nums">{formatCurrency(liquidationAlert.ownGapRemaining)}</span>
                （「剩余回本」在记法 A 下与红条重叠后的自有侧示意缺口）。可结合上方「经营回本」与交易记录核对。
              </p>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">品类</p>
                <p className="font-medium">{item.category?.name || '-'}</p>
              </div>
            </div>

            {item.serial_number && (
              <div className="flex items-center gap-3">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">序列号</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                    {item.serial_number}
                  </code>
                </div>
              </div>
            )}

            {item.mount && (
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">卡口类型</p>
                  <p className="font-medium">{item.mount}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">购买价格</p>
                <p className="font-medium">{formatCurrency(item.purchase_price)}</p>
              </div>
            </div>

            {item.purchase_date && (
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">购买日期</p>
                  <p className="font-medium">{formatDateShort(item.purchase_date)}</p>
                </div>
              </div>
            )}

            {item.purchase_date && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">已购入时长</p>
                  <p className="font-medium">{formatOwnershipDuration(item.purchase_date)}</p>
                </div>
              </div>
            )}

            {item.purchase_invoice_url && (
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">购买发票</p>
                  <a
                    href={item.purchase_invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline font-medium"
                  >
                    查看发票
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            {item.notes && (
              <div>
                <p className="text-sm text-muted-foreground">备注</p>
                <p className="font-medium">{item.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 统计数据 */}
        <Card>
          <CardHeader>
            <CardTitle>统计信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">购买成本</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatCurrency(item.purchase_price || 0)}
              </p>
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/30 p-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">经营回本</p>
                {(item.payback_progress_pct ?? 0) >= 100 ? (
                  <Badge variant="secondary" className="text-green-700">
                    已回本
                  </Badge>
                ) : null}
              </div>
              <p
                className={`mt-1 text-2xl font-semibold tabular-nums sm:text-3xl ${
                  (item.payback_progress_pct ?? 0) >= 100 ? 'text-green-600' : ''
                }`}
              >
                {(item.payback_progress_pct ?? 0).toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                比例可超过 100%；下方进度条满格表示已覆盖购置，超额以金额与比例共同体现。
              </p>
              <Progress
                value={clampPaybackForBar(item.payback_progress_pct ?? 0)}
                className={`mt-3 h-2.5 ${
                  (item.payback_progress_pct ?? 0) >= 100 ? '[&>*]:bg-green-600' : ''
                }`}
              />
              <dl className="mt-4 grid gap-2 text-sm">
                {(item.payback_excess_amount ?? 0) > 0 ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">较购置超额收回</dt>
                    <dd className="font-medium tabular-nums text-green-600">
                      {formatCurrency(item.payback_excess_amount ?? 0)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">剩余回本</dt>
                  <dd className="font-medium tabular-nums">{formatCurrency(item.payback_remaining ?? 0)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">经营累计净额</dt>
                  <dd
                    className={`font-medium tabular-nums ${(item.operating_surplus ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {formatCurrency(item.operating_surplus ?? 0)}
                  </dd>
                </div>
                {(item.financing_disbursement_total ?? 0) > 0 ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">融资覆盖购置</dt>
                    <dd className="font-medium tabular-nums">{formatCurrency(item.financing_disbursement_total ?? 0)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">自付购置（估算）</dt>
                  <dd className="font-medium tabular-nums">{formatCurrency(item.owner_equity_purchase ?? 0)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                回本比例 =（经营口径收入 − 非购置支出）÷ 有效购置价；融资放款入账不计入经营收入。超过 100% 时「较购置超额收回」为经营净额高出有效购置价的部分。
              </p>
            </div>

            {(item.effective_purchase_cost ?? 0) > 0 ? (
              <div className="rounded-lg border border-border/80 bg-background/60 p-4">
                <p className="text-sm font-medium text-muted-foreground">购置结构（ALM · 记法 A）</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  红：进行中融资<strong>剩余本金</strong>（仅融资表，租金不冲减）。黄：「剩余回本」相对红条的<strong>示意缺口</strong>。绿：经营已超过购置的<strong>超额收回</strong>。
                </p>
                <div className="mt-3">
                  <AlmStackedBar
                    effectivePurchase={item.effective_purchase_cost}
                    unpaidLoan={item.financing_principal_remaining ?? 0}
                    paybackRemaining={item.payback_remaining ?? 0}
                    paybackExcess={item.payback_excess_amount ?? 0}
                  />
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-sm text-muted-foreground">总收入</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatCurrency(item.total_revenue || 0)}
              </p>
            </div>

            {item.sold_price && (
              <div>
                <p className="text-sm text-muted-foreground">出售价格</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatCurrency(item.sold_price)}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">净收益</p>
              <p className={`text-2xl font-semibold tabular-nums ${(item.net_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(item.net_profit || 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                含设备购置及全部支出口径，与上方「经营回本」不同。
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">账面条目 ROI</p>
              <p className={`text-lg font-semibold ${(item.roi || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(item.roi || 0) >= 0 ? '+' : ''}{(item.roi || 0).toFixed(2)}%
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">总出租天数</p>
              <p className="text-2xl font-semibold tabular-nums">{item.total_days_rented || 0} 天</p>
            </div>
          </CardContent>
        </Card>

        {/* 收入记录 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                交易记录
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={() => setMaintenanceDialogOpen(true)} 
                  size="sm"
                  variant="outline"
                >
                  <Wrench className="mr-2 h-4 w-4" />
                  添加维护记录
                </Button>
                <Button asChild size="sm">
                  <Link href={`/transactions/new?itemId=${itemId}`}>
                    <Plus className="mr-2 h-4 w-4" />
                    记录历史收入
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p>暂无收入记录</p>
                <p className="text-sm mt-2">点击"记录历史收入"按钮添加历史收入记录</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="rounded-lg border border-border/60 bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {formatDateShort(transaction.transaction_date)}
                          </p>
                          <p className="mt-1 text-lg font-semibold tabular-nums">
                            {formatCurrency(transaction.amount)}
                          </p>
                        </div>
                        {transaction.order_id ? (
                          <Link
                            href={`/orders/${transaction.order_id}`}
                            className="shrink-0 text-xs text-primary hover:underline"
                          >
                            关联订单
                          </Link>
                        ) : (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            手动创建
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm">
                        <span className="text-muted-foreground">类别：</span>
                        {transaction.category || '—'}
                      </p>
                      {transaction.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {transaction.description}
                        </p>
                      ) : null}
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                          <Link href={`/transactions/${transaction.id}/edit`}>编辑</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setTransactionToDelete(transaction)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden min-w-0 lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>类别</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatDateShort(transaction.transaction_date)}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell>{transaction.category || '-'}</TableCell>
                      <TableCell>{transaction.description || '-'}</TableCell>
                      <TableCell>
                        {transaction.order_id ? (
                          <Link
                            href={`/orders/${transaction.order_id}`}
                            className="text-sm text-primary hover:underline"
                          >
                            订单 {transaction.order_id.slice(0, 8)}...
                          </Link>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            手动创建
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/transactions/${transaction.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTransactionToDelete(transaction)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这笔交易记录吗？
              <br />
              {transactionToDelete?.auto_created && (
                <span className="text-muted-foreground text-sm mt-2 block">
                  注意：这是一条自动创建的交易记录，删除后可能会影响统计数据。
                </span>
              )}
              <br />
              <span className="text-destructive font-medium">
                此操作无法撤销。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTransaction}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 添加维护记录对话框 */}
      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加维护记录</DialogTitle>
            <DialogDescription>
              记录设备的维护费用，将自动创建一条支出交易记录
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitMaintenance} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maintenance-amount">维护费用 (¥) *</Label>
              <Input
                id="maintenance-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={maintenanceForm.amount}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, amount: e.target.value })}
                placeholder="100.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenance-description">维护说明</Label>
              <Textarea
                id="maintenance-description"
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                placeholder="例如：镜头贴膜、清洁保养等"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenance-date">维护日期 *</Label>
              <Input
                id="maintenance-date"
                type="date"
                value={maintenanceForm.transaction_date}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, transaction_date: e.target.value })}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMaintenanceDialogOpen(false)}
                disabled={submittingMaintenance}
              >
                取消
              </Button>
              <Button type="submit" disabled={submittingMaintenance}>
                {submittingMaintenance ? '添加中...' : '确定添加'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
