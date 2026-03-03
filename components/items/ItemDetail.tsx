'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Package, DollarSign, Calendar as CalendarIcon, Hash, Edit, FileText, ExternalLink, Plus, TrendingUp, Trash2, Wrench } from 'lucide-react'
import type { ItemWithStats, Transaction } from '@/lib/types/database'
import { formatCurrency, formatDateShort } from '@/lib/utils/format'
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

  useEffect(() => {
    loadItem()
    loadTransactions()
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
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
            <h2 className="text-3xl font-bold tracking-tight">{item.name}</h2>
            {item.brand && item.model && (
              <p className="text-muted-foreground">{item.brand} {item.model}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push(`/items/${item.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
          <Button onClick={() => router.push('/items/new')}>
            <Plus className="mr-2 h-4 w-4" />
            继续新增资产
          </Button>
          <Badge variant={getStatusBadgeVariant(item.status)}>
            {getStatusLabel(item.status)}
          </Badge>
        </div>
      </div>

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
              <p className="text-2xl font-bold">
                {formatCurrency(item.purchase_price || 0)}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">总收入</p>
              <p className="text-2xl font-bold">
                {formatCurrency(item.total_revenue || 0)}
              </p>
            </div>

            {item.sold_price && (
              <div>
                <p className="text-sm text-muted-foreground">出售价格</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(item.sold_price)}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">净收益</p>
              <p className={`text-2xl font-bold ${(item.net_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(item.net_profit || 0)}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">ROI（投资回报率）</p>
              <p className={`text-2xl font-bold ${(item.roi || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(item.roi || 0) >= 0 ? '+' : ''}{(item.roi || 0).toFixed(2)}%
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">总出租天数</p>
              <p className="text-2xl font-bold">{item.total_days_rented || 0} 天</p>
            </div>
          </CardContent>
        </Card>

        {/* 收入记录 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                交易记录
              </CardTitle>
              <div className="flex gap-2">
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
