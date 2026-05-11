'use client'

import Link from 'next/link'
import type { ItemAccountBinding } from '@/lib/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Gamepad2, Monitor } from 'lucide-react'
import { formatDateShort } from '@/lib/utils/format'

function getBindingTypeLabel(type: string | null) {
  if (type === 'primary') return '主认证'
  if (type === 'non_primary') return '非主认证'
  return '单独租赁'
}

function getBindingTypeBadgeVariant(type: string | null): 'default' | 'secondary' | 'outline' {
  if (type === 'primary') return 'default'
  if (type === 'non_primary') return 'secondary'
  return 'outline'
}

type Props = { binding: ItemAccountBinding }

export function AccountBindingListMobileCard({ binding }: Props) {
  const catName = (binding.account_item?.category as { name?: string } | undefined)?.name

  return (
    <article className="min-w-0 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-2">
        <Badge variant={getBindingTypeBadgeVariant(binding.binding_type)}>
          {getBindingTypeLabel(binding.binding_type)}
        </Badge>
        {binding.bind_end_date === null ? (
          <Badge variant="default" className="bg-green-600">
            活跃
          </Badge>
        ) : (
          <Badge variant="secondary">已结束</Badge>
        )}
      </div>

      <div className="mt-3 space-y-3 text-sm">
        <div>
          <div className="text-xs font-medium text-muted-foreground">游戏账号</div>
          <div className="mt-1 flex items-start gap-2">
            <Gamepad2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="font-medium break-words">{binding.account_item?.name || '未知账号'}</div>
              {catName && <div className="text-xs text-muted-foreground">{catName}</div>}
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground">绑定设备</div>
          <div className="mt-1 flex items-start gap-2">
            <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              {binding.device_item ? (
                <>
                  <div className="break-words font-medium">{binding.device_item.name}</div>
                  {binding.device_item.brand && binding.device_item.model && (
                    <div className="text-xs text-muted-foreground">
                      {binding.device_item.brand} {binding.device_item.model}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">单独租赁</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-xs">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">开始 </span>
            <span>{formatDateShort(new Date(binding.bind_start_date))}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">结束 </span>
            {binding.bind_end_date ? (
              <span>{formatDateShort(new Date(binding.bind_end_date))}</span>
            ) : (
              <Badge variant="outline" className="text-green-600">
                进行中
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-border/60 pt-3">
        {binding.order_id ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/orders/${binding.order_id}`}>查看订单</Link>
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">无关联订单</span>
        )}
      </div>
    </article>
  )
}
