'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { TrendingUp, TrendingDown, Plus, Trash2, Edit, Sparkles, Filter, Package, AlertCircle } from 'lucide-react'
import type { Transaction, BusinessLine } from '@/lib/types/database'
import Link from 'next/link'
import { formatCurrency, formatDateShort } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { apiFetch, ApiFetchError } from '@/lib/api/fetcher'

interface TransactionStats {
  totalIncome: number
  totalExpense: number
  netProfit: number
  transactionCount: number
}

export function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState<TransactionStats>({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    transactionCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  // 统计范围状态（同时控制统计和交易列表）；默认全部，与各业务线汇总一起看
  const [statsBusinessLine, setStatsBusinessLine] = useState<'all' | BusinessLine>('all')
  /** 仅在「全部」时加载：各业务线小计（便于对照，点击可钻取） */
  const [lineBreakdown, setLineBreakdown] = useState<
    Partial<Record<BusinessLine, { income: number; expense: number; net: number }>>
  >({})
  const [lineBreakdownLoading, setLineBreakdownLoading] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  
  // 资产估值状态
  const [assetsValue, setAssetsValue] = useState({
    totalPurchasePrice: 0,
    assetCount: 0,
  })
  const [depreciationRate, setDepreciationRate] = useState(() => {
    // 从 localStorage 读取残值率，默认 50
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('asset_depreciation_rate')
      return saved ? parseInt(saved, 10) : 50
    }
    return 50
  })
  // 残值率输入框的临时状态（允许为空字符串）
  const [depreciationRateInput, setDepreciationRateInput] = useState<string>('')
  // 加载错误信息（用于向用户展示具体原因）
  const [loadError, setLoadError] = useState<string | null>(null)

  const toastError = (err: unknown, fallback: string) => {
    const message = err instanceof ApiFetchError ? err.message : err instanceof Error ? err.message : fallback
    const code = err instanceof ApiFetchError ? err.code : undefined
    toast.error(message, code ? { description: code } : undefined)
  }
  
  // 主数据加载 useEffect（当统计范围变化时）
  useEffect(() => {
    setLoadError(null)
    const controller = new AbortController()
    
    Promise.all([
      loadTransactions(controller.signal),
      loadStats(controller.signal),
      loadAssetsValue()
    ]).catch((error) => {
      // AbortError is expected when filter changes rapidly, don't log it
      if (error.name !== 'AbortError') {
        console.error('Failed to load transaction data:', error)
      }
    })
    
    // Cleanup: abort any in-flight requests when filter changes or component unmounts
    return () => controller.abort()
  }, [statsBusinessLine])

  useEffect(() => {
    if (statsBusinessLine !== 'all') {
      setLineBreakdown({})
      setLineBreakdownLoading(false)
      return
    }
    const lines: BusinessLine[] = ['rental', 'badminton', 'youtube', 'wechat_video']
    const ac = new AbortController()
    setLineBreakdownLoading(true)
    Promise.all(
      lines.map((bl) =>
        apiFetch<{
          totalIncome?: number
          totalExpense?: number
          netProfit?: number
        }>(`/api/transactions/stats?businessLine=${bl}`, { signal: ac.signal })
      )
    )
      .then((rows) => {
        const next: Partial<Record<BusinessLine, { income: number; expense: number; net: number }>> = {}
        lines.forEach((bl, i) => {
          const d = rows[i]
          next[bl] = {
            income: Number(d?.totalIncome) || 0,
            expense: Number(d?.totalExpense) || 0,
            net: Number(d?.netProfit) || 0,
          }
        })
        setLineBreakdown(next)
      })
      .catch((e) => {
        if (e instanceof Error && e.name === 'AbortError') return
        console.error('line breakdown stats failed', e)
      })
      .finally(() => setLineBreakdownLoading(false))

    return () => ac.abort()
  }, [statsBusinessLine])

  // 监听订单更新事件，自动刷新交易列表和统计数据
  useEffect(() => {
    const handleOrderUpdated = () => {
      loadTransactions()
      loadStats()
    }
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'orderUpdated') handleOrderUpdated()
    }
    window.addEventListener('orderUpdated', handleOrderUpdated)
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('orderUpdated', handleOrderUpdated)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [statsBusinessLine])
  
  // 加载资产估值数据
  useEffect(() => {
    loadAssetsValue()
  }, [])
  
  // 初始化残值率输入框显示值
  useEffect(() => {
    setDepreciationRateInput(depreciationRate.toString())
  }, [depreciationRate])

  async function loadTransactions(signal?: AbortSignal) {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      // 使用统计范围来筛选交易列表
      if (statsBusinessLine !== 'all') {
        params.append('businessLine', statsBusinessLine)
      }

      const response = await fetch(`/api/transactions?${params.toString()}`, { signal })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch transactions')
      }
      const data = await response.json()
      
      // 确保 data 是数组
      if (Array.isArray(data)) {
        setTransactions(data)
        
        // 提取所有类别
        const uniqueCategories = Array.from(
          new Set(data.map((tx: Transaction) => tx.category).filter(Boolean))
        ) as string[]
        setCategories(uniqueCategories.sort())
      } else {
        console.error('Invalid data format:', data)
        setTransactions([])
        setCategories([])
      }
    } catch (error) {
      // Handle AbortError gracefully - don't treat as error or clear data
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, do nothing
      }
      const msg = error instanceof Error ? error.message : 'Failed to load transactions'
      setLoadError(msg)
      console.error('Failed to load transactions:', error)
      // 错误时清空数据，避免显示旧数据
      setTransactions([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  async function loadStats(signal?: AbortSignal) {
    try {
      setStatsLoading(true)
      const params = new URLSearchParams()
      
      // 只使用统计范围筛选
      if (statsBusinessLine !== 'all') {
        params.append('businessLine', statsBusinessLine)
      }

      const data = await apiFetch<any>(`/api/transactions/stats?${params.toString()}`, { signal })
      
      // 验证数据格式
      if (data && typeof data === 'object') {
        setStats({
          totalIncome: Number(data.totalIncome) || 0,
          totalExpense: Number(data.totalExpense) || 0,
          netProfit: Number(data.netProfit) || 0,
          transactionCount: Number(data.transactionCount) || 0,
        })
      } else {
        console.error('Invalid stats data format:', data)
        setStats({
          totalIncome: 0,
          totalExpense: 0,
          netProfit: 0,
          transactionCount: 0,
        })
      }
    } catch (error) {
      // Handle AbortError gracefully - don't treat as error or reset data
      if (error instanceof Error && error.name === 'AbortError') {
        return // Request was cancelled, do nothing
      }
      const msg = error instanceof Error ? error.message : 'Failed to load stats'
      setLoadError(msg)
      console.error('Failed to load stats:', error)
      toastError(error, '统计加载失败，请重试')
      // 错误时重置为默认值
      setStats({
        totalIncome: 0,
        totalExpense: 0,
        netProfit: 0,
        transactionCount: 0,
      })
    } finally {
      setStatsLoading(false)
    }
  }

  async function loadAssetsValue() {
    try {
      const response = await fetch('/api/items/assets-value')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch assets value')
      }
      const data = await response.json()
      
      if (data && typeof data === 'object') {
        setAssetsValue({
          totalPurchasePrice: Number(data.totalPurchasePrice) || 0,
          assetCount: Number(data.assetCount) || 0,
        })
      } else {
        setAssetsValue({
          totalPurchasePrice: 0,
          assetCount: 0,
        })
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch assets value'
      setLoadError(msg)
      console.error('Failed to load assets value:', error)
      setAssetsValue({
        totalPurchasePrice: 0,
        assetCount: 0,
      })
    }
  }
  
  // 处理残值率输入变化（允许任意输入，包括空字符串）
  const handleDepreciationRateInputChange = (value: string) => {
    // 允许空字符串或纯数字
    if (value === '' || /^\d+$/.test(value)) {
      setDepreciationRateInput(value)
    }
  }
  
  // 处理回车键或失去焦点时验证并保存
  const handleDepreciationRateConfirm = () => {
    const rate = parseInt(depreciationRateInput, 10)
    if (!isNaN(rate) && rate >= 0 && rate <= 100) {
      setDepreciationRate(rate)
      if (typeof window !== 'undefined') {
        localStorage.setItem('asset_depreciation_rate', rate.toString())
      }
    } else {
      // 如果输入无效，恢复为当前的有效值
      setDepreciationRateInput(depreciationRate.toString())
    }
  }
  
  // 处理失去焦点时验证并保存
  const handleDepreciationRateBlur = () => {
    handleDepreciationRateConfirm()
  }
  
  // 处理回车键
  const handleDepreciationRateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault() // 防止表单提交（如果有表单的话）
      handleDepreciationRateConfirm()
      // 让输入框失去焦点，触发视觉反馈
      e.currentTarget.blur()
    }
  }
  
  // 计算资产残值
  const estimatedResidualValue = useMemo(() => {
    return Math.round(assetsValue.totalPurchasePrice * (depreciationRate / 100))
  }, [assetsValue.totalPurchasePrice, depreciationRate])
  
  // 计算预期总收益（净利润 + 预估残值）
  const expectedTotalProfit = useMemo(() => {
    return stats.netProfit + estimatedResidualValue
  }, [stats.netProfit, estimatedResidualValue])

  async function handleDelete() {
    if (!transactionToDelete) return

    setDeleting(true)
    try {
      await apiFetch(`/api/transactions?id=${transactionToDelete.id}`, { method: 'DELETE' })

      await loadTransactions()
      await loadStats()
      setDeleteDialogOpen(false)
      setTransactionToDelete(null)
    } catch (error) {
      console.error('Failed to delete transaction:', error)
      toastError(error, '删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }


  const getTypeBadgeVariant = (type: string) => {
    return type === 'income' ? 'success' : 'destructive'
  }

  const getTypeLabel = (type: string) => {
    return type === 'income' ? '收入' : '支出'
  }

  if (loading && transactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">交易记录</h2>
          <p className="text-muted-foreground">管理所有收入和支出记录</p>
        </div>
        <Button asChild>
          <Link
            href={
              statsBusinessLine === 'all'
                ? '/transactions/new'
                : `/transactions/new?businessLine=${statsBusinessLine}`
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            新增交易
          </Link>
        </Button>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{loadError}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={() => setLoadError(null)}
          >
            关闭
          </Button>
        </div>
      )}

      {/* 统计切换 */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">统计范围：</span>
          <div className="flex flex-wrap rounded-lg border bg-muted/50 p-0.5 gap-0.5">
            {(['all', 'rental', 'badminton', 'youtube', 'wechat_video'] as const).map((bl) => (
              <button
                key={bl}
                type="button"
                onClick={() => setStatsBusinessLine(bl)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  statsBusinessLine === bl ? 'bg-background shadow' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {bl === 'all'
                  ? '全部'
                  : bl === 'rental'
                    ? '租赁业务'
                    : bl === 'badminton'
                      ? '羽毛球副业'
                      : bl === 'youtube'
                        ? 'YouTube频道'
                        : '微信视频号'}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground pl-0 sm:pl-[4.5rem]">
          默认展示全部业务线汇总；点选某一业务线后，下方卡片与表格仅含该线。新增交易会带上当前选中的业务线。
        </p>
      </div>

      {statsBusinessLine === 'all' && (
        <Card className={cn(lineBreakdownLoading && 'opacity-70')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">各业务线对照</CardTitle>
            <CardDescription>点击某一卡片可查看该线交易明细与统计</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(['rental', 'badminton', 'youtube', 'wechat_video'] as const).map((bl) => {
                const row = lineBreakdown[bl]
                const label =
                  bl === 'rental'
                    ? '租赁业务'
                    : bl === 'badminton'
                      ? '羽毛球副业'
                      : bl === 'youtube'
                        ? 'YouTube'
                        : '微信视频号'
                return (
                  <button
                    key={bl}
                    type="button"
                    onClick={() => setStatsBusinessLine(bl)}
                    className="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/50 hover:border-primary/30"
                  >
                    <div className="text-sm font-medium">{label}</div>
                    <div
                      className={cn(
                        'mt-1 text-lg font-semibold tabular-nums',
                        (row?.net ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {row ? formatCurrency(row.net) : lineBreakdownLoading ? '…' : formatCurrency(0)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                      收 {row ? formatCurrency(row.income) : '—'} / 支 {row ? formatCurrency(row.expense) : '—'}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className={cn(statsLoading && "opacity-60")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总收入</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold text-green-600",
              statsLoading && "animate-pulse"
            )}>
              {formatCurrency(stats.totalIncome)}
            </div>
          </CardContent>
        </Card>
        
        <Card className={cn(statsLoading && "opacity-60")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总支出</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold text-red-600",
              statsLoading && "animate-pulse"
            )}>
              {formatCurrency(stats.totalExpense)}
            </div>
          </CardContent>
        </Card>
        
        <Card className={cn(statsLoading && "opacity-60")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">净利润</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              stats.netProfit >= 0 ? "text-green-600" : "text-red-600",
              statsLoading && "animate-pulse"
            )}>
              {formatCurrency(stats.netProfit)}
            </div>
          </CardContent>
        </Card>
        
        <Card className={cn(statsLoading && "opacity-60")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">交易笔数</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              statsLoading && "animate-pulse"
            )}>
              {stats.transactionCount}
            </div>
          </CardContent>
        </Card>
        
        {/* 资产预估残值 - 仅显示租赁业务或全部时 */}
        {(statsBusinessLine === 'rental' || statsBusinessLine === 'all') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">资产预估残值</CardTitle>
              <Package className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground">资产总值：</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(assetsValue.totalPurchasePrice)}
                  </span>
                </div>
                {assetsValue.assetCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {assetsValue.assetCount} 项资产
                  </p>
                )}
              </div>
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Label htmlFor="depreciation_rate" className="text-xs text-muted-foreground whitespace-nowrap">
                    残值率：
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id="depreciation_rate"
                      type="text"
                      inputMode="numeric"
                      value={depreciationRateInput}
                      onChange={(e) => handleDepreciationRateInputChange(e.target.value)}
                      onBlur={handleDepreciationRateBlur}
                      onKeyDown={handleDepreciationRateKeyDown}
                      className="h-7 text-sm w-16"
                      placeholder="50"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground">预估残值：</span>
                  <span className={cn(
                    "text-lg font-bold",
                    estimatedResidualValue >= 0 ? "text-blue-600" : "text-muted-foreground"
                  )}>
                    {formatCurrency(estimatedResidualValue)}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 pt-1 border-t">
                  <span className="text-xs text-muted-foreground">预期总收益：</span>
                  <div className="flex flex-col gap-0.5">
                    <span className={cn(
                      "text-lg font-bold",
                      expectedTotalProfit >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatCurrency(expectedTotalProfit)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (净利润 + 残值)
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>


      {/* 交易列表 */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">暂无交易记录</h3>
                <p className="text-muted-foreground">
                  开始添加你的第一笔交易记录吧
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>交易列表</CardTitle>
            <CardDescription>共 {transactions.length} 笔交易</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>类别</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={getTypeBadgeVariant(transaction.type)}>
                          {transaction.type === 'income' ? (
                            <TrendingUp className="mr-1 h-3 w-3" />
                          ) : (
                            <TrendingDown className="mr-1 h-3 w-3" />
                          )}
                          {getTypeLabel(transaction.type)}
                        </Badge>
                        {transaction.auto_created && (
                          <Badge variant="outline" className="text-xs">
                            <Sparkles className="mr-1 h-3 w-3" />
                            自动
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>{transaction.category || '-'}</TableCell>
                    <TableCell>{transaction.description || '-'}</TableCell>
                    <TableCell>{formatDateShort(transaction.transaction_date)}</TableCell>
                    <TableCell>
                      {transaction.order_id ? (
                        <Link
                          href={`/orders/${transaction.order_id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          订单 {transaction.order_id.slice(0, 8)}...
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">手动创建</span>
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
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这笔交易记录吗？
              <br />
              <span className="text-destructive font-medium">
                此操作无法撤销。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
