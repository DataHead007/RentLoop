'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Plus, Scale, Trash2 } from 'lucide-react'
import type { Order, OrderCompensation, OrderItem } from '@/lib/types/database'
import { formatCurrency, formatDateShort } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import {
  COMPENSATION_EXPENSE_CATEGORIES,
  COMPENSATION_INCOME_CATEGORIES,
  defaultCategoryForDirection,
  getOrderItemRentLineAmount,
  type CompensationDirection,
} from '@/lib/orders/orderCompensation'

type CompensationDraftRow = {
  draft_id: string
  order_item_id: string
  item_id: string | null
  item_name: string
  rent_line_amount: number
  purchase_price: number
  direction: CompensationDirection
  category: string
  amount: string
  reason: string
  allocation_method: 'manual' | 'rent_ratio' | 'purchase_ratio' | null
}

type OrderCompensationSectionProps = {
  order: Order
  orderId: string
  onSaved: () => Promise<void>
}

function newDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function metaFromOrderItem(oi: OrderItem) {
  return {
    order_item_id: oi.id,
    item_id: oi.item_id,
    item_name: oi.item?.name ?? '未命名资产',
    rent_line_amount: getOrderItemRentLineAmount(oi),
    purchase_price: oi.item?.purchase_price ?? 0,
  }
}

function buildEmptyRow(oi: OrderItem, overrides?: Partial<CompensationDraftRow>): CompensationDraftRow {
  return {
    draft_id: newDraftId(),
    ...metaFromOrderItem(oi),
    direction: 'income',
    category: '赔偿收入',
    amount: '',
    reason: '',
    allocation_method: null,
    ...overrides,
  }
}

function rowFromCompensation(comp: OrderCompensation, oi: OrderItem | undefined): CompensationDraftRow {
  const meta = oi ? metaFromOrderItem(oi) : {
    order_item_id: comp.order_item_id ?? '',
    item_id: comp.item_id,
    item_name: comp.item?.name ?? '未命名资产',
    rent_line_amount: 0,
    purchase_price: comp.item?.purchase_price ?? 0,
  }
  return {
    draft_id: comp.id,
    ...meta,
    direction: comp.direction,
    category: comp.category,
    amount: String(comp.amount),
    reason: comp.reason ?? '',
    allocation_method: comp.allocation_method,
  }
}

function rowsFromOrder(order: Order): CompensationDraftRow[] {
  const items = order.order_items ?? []
  const comps = order.order_compensations ?? []

  if (comps.length > 0) {
    return comps.map((comp) => {
      const oi = items.find((i) => i.id === comp.order_item_id)
      return rowFromCompensation(comp, oi)
    })
  }

  if (items.length === 0) return []
  return [buildEmptyRow(items[0])]
}

export function OrderCompensationSection({ order, orderId, onSaved }: OrderCompensationSectionProps) {
  const [rows, setRows] = useState<CompensationDraftRow[]>(() => rowsFromOrder(order))
  const [transactionDate, setTransactionDate] = useState(
    () => order.order_compensations?.[0]?.transaction_date?.split('T')[0] ?? order.end_date?.split('T')[0] ?? ''
  )
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setRows(rowsFromOrder(order))
    const existingDate = order.order_compensations?.[0]?.transaction_date?.split('T')[0]
    if (existingDate) {
      setTransactionDate(existingDate)
    }
    setDirty(false)
  }, [order])

  const orderItems = order.order_items ?? []
  const hasItems = orderItems.length > 0
  const orderItemById = useMemo(
    () => new Map(orderItems.map((oi) => [oi.id, oi])),
    [orderItems]
  )

  const savedSummary = useMemo(() => {
    const comps = order.order_compensations ?? []
    let income = 0
    let expense = 0
    for (const c of comps) {
      if (c.direction === 'income') income += c.amount
      else expense += c.amount
    }
    return { income, expense, count: comps.length }
  }, [order.order_compensations])

  const draftTotals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const row of rows) {
      const amt = parseFloat(row.amount) || 0
      if (amt <= 0) continue
      if (row.direction === 'income') income += amt
      else expense += amt
    }
    return { income, expense }
  }, [rows])

  const updateRow = useCallback((draftId: string, patch: Partial<CompensationDraftRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.draft_id !== draftId) return r
        const next = { ...r, ...patch, allocation_method: 'manual' as const }
        if (patch.direction) {
          next.category = defaultCategoryForDirection(patch.direction)
        }
        if (patch.order_item_id && patch.order_item_id !== r.order_item_id) {
          const oi = orderItemById.get(patch.order_item_id)
          if (oi) {
            Object.assign(next, metaFromOrderItem(oi))
          }
        }
        return next
      })
    )
    setDirty(true)
  }, [orderItemById])

  const removeRow = useCallback((draftId: string) => {
    setRows((prev) => prev.filter((r) => r.draft_id !== draftId))
    setDirty(true)
  }, [])

  const addRow = useCallback(
    (preset?: Partial<Pick<CompensationDraftRow, 'order_item_id' | 'direction' | 'category'>>) => {
      const targetId = preset?.order_item_id ?? orderItems[0]?.id
      const oi = targetId ? orderItemById.get(targetId) : orderItems[0]
      if (!oi) return
      setRows((prev) => [
        ...prev,
        buildEmptyRow(oi, {
          direction: preset?.direction ?? 'income',
          category: preset?.category ?? defaultCategoryForDirection(preset?.direction ?? 'income'),
        }),
      ])
      setDirty(true)
    },
    [orderItemById, orderItems]
  )

  const handleSave = async () => {
    if (!transactionDate) {
      toast.error('请选择记账日期')
      return
    }

    const lines = rows
      .map((r) => ({
        order_item_id: r.order_item_id,
        item_id: r.item_id,
        direction: r.direction,
        category: r.category,
        amount: parseFloat(r.amount) || 0,
        reason: r.reason.trim() || null,
        allocation_method: r.allocation_method ?? 'manual',
      }))
      .filter((l) => l.amount > 0)

    setSaving(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/compensations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_date: transactionDate,
          lines,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg =
          (err as { error?: string }).error ||
          (err as { errorDetail?: { message?: string } }).errorDetail?.message ||
          '保存失败'
        throw new Error(msg)
      }
      toast.success(
        lines.length > 0 ? `已保存 ${lines.length} 笔赔偿/维修并写入交易` : '已清除赔偿记录'
      )
      setDirty(false)
      await onSaved()
      window.dispatchEvent(new CustomEvent('transactionUpdated'))
      localStorage.setItem('transactionUpdated', Date.now().toString())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!hasItems) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-5 w-5 text-amber-600" />
          赔偿 / 扣款
        </CardTitle>
        <CardDescription>
          同一资产可添加多行（例如一行收客户赔偿、一行记维修支出）。保存后每行生成独立交易。
          <span className="mt-1 block text-amber-700/90">
            维修支出与资产「添加维护记录」计入同一类目（维护费用），请勿重复录入。
          </span>
          {savedSummary.count > 0 ? (
            <span className="mt-1 block text-foreground/70">
              已记录 {savedSummary.count} 笔 · 收到 {formatCurrency(savedSummary.income)}
              {savedSummary.expense > 0 ? ` · 支出 ${formatCurrency(savedSummary.expense)}` : ''}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,10rem)_1fr] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="comp-tx-date">记账日期</Label>
            <Input
              id="comp-tx-date"
              type="date"
              value={transactionDate}
              onChange={(e) => {
                setTransactionDate(e.target.value)
                setDirty(true)
              }}
            />
          </div>
          {(draftTotals.income > 0 || draftTotals.expense > 0) && (
            <p className="text-sm text-muted-foreground sm:pb-2">
              当前草稿：收到 {formatCurrency(draftTotals.income)}
              {draftTotals.expense > 0 ? ` · 支出 ${formatCurrency(draftTotals.expense)}` : ''}
            </p>
          )}
        </div>

        <div className="min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <Table className="min-w-[48rem]">
            <TableHeader>
              <TableRow>
                <TableHead>资产</TableHead>
                <TableHead className="text-right">租金</TableHead>
                <TableHead className="text-right">购置价</TableHead>
                <TableHead>方向</TableHead>
                <TableHead>类目</TableHead>
                <TableHead className="w-28">金额</TableHead>
                <TableHead>原因</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    暂无记录，点击下方「添加一行」开始填写
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                const rowCategories =
                  row.direction === 'income'
                    ? COMPENSATION_INCOME_CATEGORIES
                    : COMPENSATION_EXPENSE_CATEGORIES
                const amt = parseFloat(row.amount) || 0
                return (
                  <TableRow key={row.draft_id}>
                    <TableCell>
                      {orderItems.length > 1 ? (
                        <Select
                          value={row.order_item_id}
                          onValueChange={(v) => updateRow(row.draft_id, { order_item_id: v })}
                        >
                          <SelectTrigger className="h-8 min-w-[10rem] font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {orderItems.map((oi) => (
                              <SelectItem key={oi.id} value={oi.id}>
                                {oi.item?.name ?? '未命名资产'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="font-medium">{row.item_name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {formatCurrency(row.rent_line_amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {formatCurrency(row.purchase_price)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.direction}
                        onValueChange={(v: CompensationDirection) =>
                          updateRow(row.draft_id, { direction: v })
                        }
                      >
                        <SelectTrigger className="h-8 w-[7.5rem]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">收到</SelectItem>
                          <SelectItem value="expense">付出</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.category}
                        onValueChange={(v) => updateRow(row.draft_id, { category: v })}
                      >
                        <SelectTrigger className="h-8 w-[7rem]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {rowCategories.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        className={cn(
                          'h-8 w-24 tabular-nums',
                          row.allocation_method &&
                            row.allocation_method !== 'manual' &&
                            amt > 0 &&
                            'border-amber-200'
                        )}
                        value={row.amount}
                        onChange={(e) => updateRow(row.draft_id, { amount: e.target.value })}
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 min-w-[8rem]"
                        value={row.reason}
                        onChange={(e) => updateRow(row.draft_id, { reason: e.target.value })}
                        placeholder="原因"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(row.draft_id)}
                        aria-label="删除此行"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => addRow()}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            添加一行
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addRow({ direction: 'expense', category: '维护费用' })}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            添加维修支出
          </Button>
          <span className="text-xs text-muted-foreground">
            例：第 1 行收赔偿 ¥500，第 2 行维修支出 ¥200
          </span>
        </div>

        {order.order_compensations && order.order_compensations.length > 0 && (
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            最近保存：
            {order.order_compensations.map((c) => (
              <span key={c.id} className="mr-3 inline-block">
                {c.item?.name ?? '资产'} {c.direction === 'income' ? '+' : '-'}
                {formatCurrency(c.amount)} ({c.category})
                {c.reason ? ` · ${c.reason}` : ''} · {formatDateShort(c.transaction_date)}
              </span>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" disabled={saving || !dirty} onClick={handleSave}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存赔偿记录
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
