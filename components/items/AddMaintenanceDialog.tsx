'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { format } from 'date-fns'

type AddMaintenanceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId: string
  itemName?: string | null
  onSuccess?: () => void | Promise<void>
}

export function AddMaintenanceDialog({
  open,
  onOpenChange,
  itemId,
  itemName,
  onSuccess,
}: AddMaintenanceDialogProps) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [transactionDate, setTransactionDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount('')
    setDescription('')
    setTransactionDate(format(new Date(), 'yyyy-MM-dd'))
  }, [open, itemId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const parsed = parseFloat(amount)
    if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
      toast.error('请输入有效的维护费用金额')
      return
    }
    if (!transactionDate) {
      toast.error('请选择维护日期')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          order_id: null,
          type: 'expense',
          amount: -Math.abs(parsed),
          category: '维护费用',
          description: description.trim() || '设备维护',
          transaction_date: transactionDate,
          auto_created: false,
          business_plate: 'rental',
          creator_channel: null,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
          (error as { error?: string }).error ||
            (error as { errorDetail?: { message?: string } }).errorDetail?.message ||
            '创建维护记录失败'
        )
      }

      toast.success(`已记录维护费用 ¥${parsed.toFixed(2)}`)
      onOpenChange(false)
      await onSuccess?.()
      window.dispatchEvent(new CustomEvent('transactionUpdated'))
      localStorage.setItem('transactionUpdated', Date.now().toString())
    } catch (error) {
      console.error('Failed to create maintenance record:', error)
      toast.error(error instanceof Error ? error.message : '添加维护记录失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {itemName ? `维护 · ${itemName}` : '添加维护记录'}
          </DialogTitle>
          <DialogDescription>
            记录设备维护或配件费用，将写入一笔「维护费用」支出。与订单赔偿里的维护费用同一类目，请勿重复录入。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maintenance-amount">维护费用 (¥) *</Label>
            <Input
              id="maintenance-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance-description">维护说明</Label>
            <Textarea
              id="maintenance-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：UV 镜、贴膜、清洁保养"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance-date">维护日期 *</Label>
            <Input
              id="maintenance-date"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '添加中...' : '确定添加'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
