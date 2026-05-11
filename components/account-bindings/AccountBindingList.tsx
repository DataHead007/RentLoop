'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Gamepad2, Monitor, Calendar, Link as LinkIcon, X } from 'lucide-react'
import type { ItemAccountBinding } from '@/lib/types/database'
import Link from 'next/link'
import { formatDateShort } from '@/lib/utils/format'
import { AccountBindingListMobileCard } from './AccountBindingListMobileCard'

export function AccountBindingList() {
  const [bindings, setBindings] = useState<ItemAccountBinding[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'ended'>('all')

  useEffect(() => {
    loadBindings()
  }, [])

  async function loadBindings() {
    try {
      setLoading(true)
      const response = await fetch('/api/account-bindings')
      if (!response.ok) throw new Error('Failed to fetch account bindings')
      const data = await response.json()
      setBindings(data)
    } catch (error) {
      console.error('Failed to load account bindings:', error)
    } finally {
      setLoading(false)
    }
  }

  // 筛选绑定记录
  const filteredBindings = useMemo(() => {
    let filtered = bindings

    // 按状态筛选
    if (filterStatus === 'active') {
      filtered = filtered.filter(b => b.bind_end_date === null)
    } else if (filterStatus === 'ended') {
      filtered = filtered.filter(b => b.bind_end_date !== null)
    }

    // 按搜索关键词筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(binding => {
        const accountName = binding.account_item?.name || ''
        const deviceName = binding.device_item?.name || ''
        const accountCategory = (binding.account_item?.category as any)?.name || ''
        return (
          accountName.toLowerCase().includes(query) ||
          deviceName.toLowerCase().includes(query) ||
          accountCategory.toLowerCase().includes(query)
        )
      })
    }

    return filtered
  }, [bindings, searchQuery, filterStatus])

  // 统计信息
  const stats = useMemo(() => {
    const active = bindings.filter(b => b.bind_end_date === null).length
    const ended = bindings.filter(b => b.bind_end_date !== null).length
    const total = bindings.length
    return { active, ended, total }
  }, [bindings])

  const getBindingTypeLabel = (type: string | null) => {
    if (type === 'primary') return '主认证'
    if (type === 'non_primary') return '非主认证'
    return '单独租赁'
  }

  const getBindingTypeBadgeVariant = (type: string | null) => {
    if (type === 'primary') return 'default'
    if (type === 'non_primary') return 'secondary'
    return 'outline'
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">加载账号绑定数据中...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">账号绑定管理</h2>
          <p className="text-muted-foreground">管理数字版游戏账号与设备的绑定关系</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总绑定记录</CardTitle>
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">所有历史绑定记录</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">当前活跃绑定</CardTitle>
            <Gamepad2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">正在使用的绑定</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已结束绑定</CardTitle>
            <X className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{stats.ended}</div>
            <p className="text-xs text-muted-foreground">历史绑定记录</p>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>绑定记录列表</CardTitle>
          <CardDescription>共 {filteredBindings.length} 条记录</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 px-4 pb-6 pt-0 sm:px-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索游戏账号、设备名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterStatus} onValueChange={(value: 'all' | 'active' | 'ended') => setFilterStatus(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="筛选状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="active">当前活跃</SelectItem>
                <SelectItem value="ended">已结束</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredBindings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Gamepad2 className="h-12 w-12 mx-auto mb-4" />
              <div>
                <h3 className="text-lg font-semibold">暂无绑定记录</h3>
                <p className="text-muted-foreground">创建订单并绑定游戏账号后，记录会显示在这里</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {filteredBindings.map((binding) => (
                  <AccountBindingListMobileCard key={binding.id} binding={binding} />
                ))}
              </div>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>游戏账号</TableHead>
                      <TableHead>绑定设备</TableHead>
                      <TableHead>绑定类型</TableHead>
                      <TableHead>开始日期</TableHead>
                      <TableHead>结束日期</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>关联订单</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBindings.map((binding) => (
                      <TableRow key={binding.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div>{binding.account_item?.name || '未知账号'}</div>
                              {(binding.account_item?.category as any)?.name && (
                                <div className="text-xs text-muted-foreground">
                                  {(binding.account_item?.category as any)?.name}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {binding.device_item ? (
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div>{binding.device_item.name}</div>
                                {binding.device_item.brand && binding.device_item.model && (
                                  <div className="text-xs text-muted-foreground">
                                    {binding.device_item.brand} {binding.device_item.model}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">单独租赁</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getBindingTypeBadgeVariant(binding.binding_type)}>
                            {getBindingTypeLabel(binding.binding_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDateShort(new Date(binding.bind_start_date))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {binding.bind_end_date ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {formatDateShort(new Date(binding.bind_end_date))}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-green-600">
                              进行中
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {binding.bind_end_date === null ? (
                            <Badge variant="default" className="bg-green-600">
                              活跃
                            </Badge>
                          ) : (
                            <Badge variant="secondary">已结束</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {binding.order_id ? (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/orders/${binding.order_id}`}>查看订单</Link>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {binding.order_id && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/orders/${binding.order_id}`}>详情</Link>
                            </Button>
                          )}
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
  )
}
