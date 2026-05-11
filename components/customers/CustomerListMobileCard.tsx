'use client'

import Link from 'next/link'
import type { Customer } from '@/lib/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Mail, Phone, Trash2 } from 'lucide-react'
import { formatCurrency, formatDateShort } from '@/lib/utils/format'

type CustomerListMobileCardProps = {
  customer: Customer
  deletingCustomerId: string | null
  onDelete: (customer: Customer) => void
}

export function CustomerListMobileCard({
  customer,
  deletingCustomerId,
  onDelete,
}: CustomerListMobileCardProps) {
  const busy = deletingCustomerId === customer.id

  return (
    <article className="min-w-0 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="text-lg font-semibold leading-tight">{customer.name}</div>

      <div className="mt-3 min-w-0 space-y-2 text-sm">
        {customer.phone ? (
          <div className="flex items-start gap-2">
            <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="break-all">{customer.phone}</span>
          </div>
        ) : null}
        {customer.email ? (
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="break-all text-muted-foreground">{customer.email}</span>
          </div>
        ) : null}
        {!customer.phone && !customer.email && (
          <p className="text-muted-foreground">无联系方式</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        <Badge variant="secondary">订单 {customer.total_orders || 0}</Badge>
        <span className="font-semibold tabular-nums">{formatCurrency(customer.total_amount || 0)}</span>
        <span className="text-xs text-muted-foreground">累计消费</span>
      </div>

      <dl className="mt-3 grid gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <div className="flex gap-2">
          <dt className="w-14 shrink-0">首次下单</dt>
          <dd className="min-w-0">
            {customer.first_order_date ? (
              <span className="inline-flex items-center gap-1 text-foreground">
                <Calendar className="h-3 w-3" />
                {formatDateShort(new Date(customer.first_order_date))}
              </span>
            ) : (
              '-'
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-14 shrink-0">最近下单</dt>
          <dd className="min-w-0">
            {customer.last_order_date ? (
              <span className="inline-flex items-center gap-1 text-foreground">
                <Calendar className="h-3 w-3" />
                {formatDateShort(new Date(customer.last_order_date))}
              </span>
            ) : (
              '-'
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/customers/${customer.id}`}>查看详情</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => onDelete(customer)}
        >
          {busy ? (
            '删除中...'
          ) : (
            <>
              <Trash2 className="mr-1 h-4 w-4" />
              删除
            </>
          )}
        </Button>
      </div>
    </article>
  )
}
