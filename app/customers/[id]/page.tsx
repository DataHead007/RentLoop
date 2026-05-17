'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, User, Phone, Mail, Calendar, DollarSign, Package } from 'lucide-react'
import { Label } from '@/components/ui/label'
import type { Customer } from '@/lib/types/database'
import Link from 'next/link'
import { formatCurrency, formatDateShort } from '@/lib/utils/format'

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string
  const [customer, setCustomer] = useState<Customer & { orders?: any[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (customerId) {
      loadCustomer()
    }
  }, [customerId])

  async function loadCustomer() {
    try {
      setLoading(true)
      const response = await fetch(`/api/customers/${customerId}`)
      if (!response.ok) throw new Error('Failed to fetch customer')
      const data = await response.json()
      setCustomer(data)
    } catch (error) {
      console.error('Failed to load customer:', error)
      alert('加载客户信息失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary'
      case 'confirmed':
        return 'default'
      case 'in_progress':
        return 'default'
      case 'completed':
        return 'success'
      case 'cancelled':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '待确认',
      confirmed: '已确认',
      in_progress: '进行中',
      completed: '已完成',
      cancelled: '已取消',
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

  if (!customer) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">客户不存在</h3>
            <Button asChild variant="outline">
              <Link href="/customers">返回客户列表</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button variant="ghost" size="sm" className="w-fit shrink-0" asChild>
          <Link href="/customers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Link>
        </Button>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">客户详情</h2>
          <p className="text-sm text-muted-foreground sm:text-base">查看客户信息和订单历史</p>
        </div>
      </div>

      {/* 客户基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm text-muted-foreground">客户姓名</Label>
              <p className="text-lg font-medium">{customer.name}</p>
            </div>
            {customer.phone && (
              <div>
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  联系电话
                </Label>
                <p className="text-lg">{customer.phone}</p>
              </div>
            )}
            {customer.email && (
              <div>
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  电子邮箱
                </Label>
                <p className="text-lg">{customer.email}</p>
              </div>
            )}
            <div>
              <Label className="text-sm text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" />
                订单总数
              </Label>
              <p className="text-lg font-medium">{customer.total_orders || 0} 个订单</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                累计消费
              </Label>
              <p className="text-lg font-medium text-green-600">
                {formatCurrency(customer.total_amount || 0)}
              </p>
            </div>
            {customer.first_order_date && (
              <div>
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  首次下单
                </Label>
                <p className="text-lg">
                  {formatDateShort(new Date(customer.first_order_date))}
                </p>
              </div>
            )}
            {customer.last_order_date && (
              <div>
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  最近下单
                </Label>
                <p className="text-lg">
                  {formatDateShort(new Date(customer.last_order_date))}
                </p>
              </div>
            )}
          </div>
          {customer.notes && (
            <div className="mt-4">
              <Label className="text-sm text-muted-foreground">备注</Label>
              <p className="text-sm mt-1">{customer.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 订单历史 */}
      {customer.orders && customer.orders.length > 0 ? (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>订单历史</CardTitle>
            <CardDescription>该客户的所有订单记录</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="space-y-3 lg:hidden">
              {customer.orders.map((order: any) => (
                <div
                  key={order.id}
                  className="rounded-lg border border-border/60 bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {order.order_number || order.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateShort(new Date(order.start_date))} ~{' '}
                        {formatDateShort(new Date(order.end_date))}
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(order.status)} className="shrink-0">
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      下单 {formatDateShort(new Date(order.created_at))}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(order.total_amount || 0)}
                    </span>
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-3 w-full sm:w-auto">
                    <Link href={`/orders/${order.id}`}>查看订单</Link>
                  </Button>
                </div>
              ))}
            </div>
            <div className="hidden min-w-0 lg:block">
            <div className="min-w-0 overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>订单号</TableHead>
                    <TableHead>下单日期</TableHead>
                    <TableHead>租赁日期</TableHead>
                    <TableHead>订单金额</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.orders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.order_number || order.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {formatDateShort(new Date(order.created_at))}
                      </TableCell>
                      <TableCell>
                        {formatDateShort(new Date(order.start_date))} ~ {formatDateShort(new Date(order.end_date))}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(order.total_amount || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(order.status)}>
                          {getStatusLabel(order.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/orders/${order.id}`}>查看订单</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">暂无订单记录</h3>
              <p className="text-muted-foreground">该客户还没有订单记录</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
