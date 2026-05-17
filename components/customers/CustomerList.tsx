'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { User, Search, Phone, Mail, Calendar, DollarSign, Package, Trash2 } from 'lucide-react'
import type { Customer } from '@/lib/types/database'
import Link from 'next/link'
import { formatCurrency, formatDateShort } from '@/lib/utils/format'
import { CustomerListMobileCard } from './CustomerListMobileCard'

export function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [missingCheck, setMissingCheck] = useState<{
    loading: boolean
    data: any | null
    error: string | null
  }>({ loading: false, data: null, error: null })
  const [fixing, setFixing] = useState(false)
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null)

  useEffect(() => {
    loadCustomers()
    
    // 监听订单更新事件，自动刷新客户列表
    const handleOrderUpdated = () => {
      console.log('[CustomerList] Order updated event received, refreshing customer list...')
      loadCustomers()
    }
    
    // 监听自定义事件
    window.addEventListener('orderUpdated', handleOrderUpdated)
    
    // 监听 localStorage 变化（跨标签页通知）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'orderUpdated') {
        console.log('[CustomerList] Order updated via localStorage, refreshing customer list...')
        loadCustomers()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    // 清理函数
    return () => {
      window.removeEventListener('orderUpdated', handleOrderUpdated)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  async function loadCustomers() {
    try {
      setLoading(true)
      const response = await fetch('/api/customers')
      if (!response.ok) throw new Error('Failed to fetch customers')
      const data = await response.json()
      setCustomers(data)
    } catch (error) {
      console.error('Failed to load customers:', error)
    } finally {
      setLoading(false)
    }
  }

  // 检查缺失的客户档案
  async function checkMissingCustomers() {
    try {
      setMissingCheck({ loading: true, data: null, error: null })
      const response = await fetch('/api/customers/check-missing')
      if (!response.ok) throw new Error('Failed to check missing customers')
      const data = await response.json()
      setMissingCheck({ loading: false, data, error: null })
    } catch (error) {
      console.error('Failed to check missing customers:', error)
      setMissingCheck({
        loading: false,
        data: null,
        error: error instanceof Error ? error.message : '检查失败'
      })
    }
  }

  // 修复缺失的客户档案
  async function fixMissingCustomers() {
    try {
      setFixing(true)
      const response = await fetch('/api/customers/check-missing', {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to fix missing customers')
      const data = await response.json()
      
      const message = `修复完成！\n创建: ${data.created} 个客户\n更新: ${data.updated} 个客户\n总计: ${data.totalProcessed} 个客户`
      alert(message)
      
      // 重新加载客户列表
      await loadCustomers()
      // 重新检查
      await checkMissingCustomers()
    } catch (error) {
      console.error('Failed to fix missing customers:', error)
      alert(`修复失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setFixing(false)
    }
  }

  // 删除客户
  async function handleDeleteCustomer(customer: Customer) {
    // 确认删除
    const confirmed = window.confirm(
      `确定要删除客户 "${customer.name}" 吗？\n\n` +
      `电话: ${customer.phone || '无'}\n` +
      `邮箱: ${customer.email || '无'}\n\n` +
      `此操作无法撤销。`
    )

    if (!confirmed) return

    try {
      setDeletingCustomerId(customer.id)
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        // 尝试解析错误响应
        let errorMessage = '删除失败'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (parseError) {
          // 如果无法解析 JSON，使用状态文本
          errorMessage = `删除失败: ${response.status} ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      // 重新加载客户列表
      await loadCustomers()
    } catch (error) {
      console.error('Failed to delete customer:', error)
      alert(`删除失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setDeletingCustomerId(null)
    }
  }

  // 筛选客户
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers
    
    const query = searchQuery.toLowerCase().trim()
    return customers.filter(customer => 
      customer.name.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query)
    )
  }, [customers, searchQuery])

  // 统计信息
  const stats = useMemo(() => {
    return {
      totalCustomers: customers.length,
      totalOrders: customers.reduce((sum, c) => sum + (c.total_orders || 0), 0),
      totalAmount: customers.reduce((sum, c) => sum + (c.total_amount || 0), 0),
    }
  }, [customers])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">客户管理</h2>
          <p className="text-sm text-muted-foreground sm:text-base">查看和管理所有客户档案</p>
        </div>
        <Button
          variant="outline"
          className="w-full shrink-0 sm:w-auto"
          onClick={checkMissingCustomers}
          disabled={missingCheck.loading}
        >
          {missingCheck.loading ? '检查中...' : '检查缺失客户'}
        </Button>
      </div>

      {/* 缺失客户检查结果 */}
      {missingCheck.data && (
        <Card className="border-orange-200/80 bg-orange-50/90">
          <CardHeader>
            <CardTitle className="text-orange-900">缺失客户检查结果</CardTitle>
            <CardDescription>
              发现 {missingCheck.data.summary.unlinkedOrders} 个订单未关联客户档案
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
              <div>
                <p className="text-sm text-muted-foreground">总订单数</p>
                <p className="text-2xl font-semibold tabular-nums">{missingCheck.data.summary.totalOrders}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">有效关联订单</p>
                <p className="text-2xl font-semibold tabular-nums text-green-600">
                  {missingCheck.data.summary.linkedOrders}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">未关联订单</p>
                <p className="text-2xl font-semibold tabular-nums text-orange-600">
                  {missingCheck.data.summary.unlinkedOrders}
                </p>
              </div>
              {missingCheck.data.summary.invalidCustomerIds > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">无效关联</p>
                  <p className="text-2xl font-semibold tabular-nums text-red-600">
                    {missingCheck.data.summary.invalidCustomerIds}
                  </p>
                  <p className="text-xs text-muted-foreground">订单有customer_id但客户不存在</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">缺失客户数</p>
                <p className="text-2xl font-semibold tabular-nums text-red-600">
                  {missingCheck.data.summary.uniqueMissingCustomers}
                </p>
              </div>
            </div>
            
            {missingCheck.data.summary.unlinkedOrders > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={fixMissingCustomers}
                  disabled={fixing}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {fixing ? '修复中...' : `修复缺失客户 (${missingCheck.data.summary.uniqueMissingCustomers} 个)`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setMissingCheck({ loading: false, data: null, error: null })}
                >
                  关闭
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 错误提示 */}
      {missingCheck.error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">检查失败: {missingCheck.error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setMissingCheck({ loading: false, data: null, error: null })}
            >
              关闭
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 统计卡片 */}
      {customers.length > 0 && (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">客户总数</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{stats.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">所有客户档案</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总订单数</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">所有客户订单合计</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">累计消费</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">{formatCurrency(stats.totalAmount)}</div>
              <p className="text-xs text-muted-foreground">所有客户消费合计</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 搜索框 */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>客户列表</CardTitle>
          <CardDescription>搜索和查看客户信息</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 px-4 pb-6 pt-0 sm:px-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="search">搜索客户</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="输入客户姓名、电话或邮箱搜索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery ? '未找到匹配的客户' : '暂无客户'}
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery ? '请尝试其他搜索关键词' : '创建订单后，客户档案会自动生成'}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {filteredCustomers.map((customer) => (
                    <CustomerListMobileCard
                      key={customer.id}
                      customer={customer}
                      deletingCustomerId={deletingCustomerId}
                      onDelete={handleDeleteCustomer}
                    />
                  ))}
                </div>
                <div className="hidden min-w-0 lg:block">
                  <div className="min-w-0 overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>客户姓名</TableHead>
                          <TableHead>联系方式</TableHead>
                          <TableHead>订单数</TableHead>
                          <TableHead>累计消费</TableHead>
                          <TableHead>首次下单</TableHead>
                          <TableHead>最近下单</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCustomers.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.name}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {customer.phone && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    <span>{customer.phone}</span>
                                  </div>
                                )}
                                {customer.email && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">{customer.email}</span>
                                  </div>
                                )}
                                {!customer.phone && !customer.email && (
                                  <span className="text-sm text-muted-foreground">无联系方式</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{customer.total_orders || 0}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(customer.total_amount || 0)}
                            </TableCell>
                            <TableCell>
                              {customer.first_order_date ? (
                                <div className="flex items-center gap-2 text-sm">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span>{formatDateShort(new Date(customer.first_order_date))}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {customer.last_order_date ? (
                                <div className="flex items-center gap-2 text-sm">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span>{formatDateShort(new Date(customer.last_order_date))}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button asChild variant="outline" size="sm">
                                  <Link href={`/customers/${customer.id}`}>查看详情</Link>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteCustomer(customer)}
                                  disabled={deletingCustomerId === customer.id}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  {deletingCustomerId === customer.id ? (
                                    '删除中...'
                                  ) : (
                                    <>
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      删除
                                    </>
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
