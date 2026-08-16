'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  formatItemRentalScheduleTooltip,
  sortItemRentalSchedules,
  formatItemRentalScheduleLine,
  type ItemRentalScheduleEntry,
} from '@/lib/items/itemRentalSchedule'

type ItemStatusWithScheduleProps = {
  label: string
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | null
  schedules?: ItemRentalScheduleEntry[]
  className?: string
  micro?: boolean
}

function ScheduleTooltipBody({ schedules }: { schedules: ItemRentalScheduleEntry[] }) {
  const sorted = sortItemRentalSchedules(schedules)
  return (
    <ul className="space-y-1 text-xs leading-snug">
      {sorted.slice(0, 4).map((entry) => (
        <li key={`${entry.order_id}-${entry.start_date}`} className="text-foreground">
          {formatItemRentalScheduleLine(entry)}
        </li>
      ))}
      {sorted.length > 4 ? (
        <li className="text-muted-foreground">另有 {sorted.length - 4} 笔订单</li>
      ) : null}
    </ul>
  )
}

export function ItemStatusWithSchedule({
  label,
  variant = 'secondary',
  schedules,
  className,
  micro = false,
}: ItemStatusWithScheduleProps) {
  const [open, setOpen] = useState(false)
  const hasSchedule = Boolean(schedules?.length)
  const tooltipText = formatItemRentalScheduleTooltip(schedules)

  const triggerClass = cn(
    hasSchedule && 'cursor-help underline decoration-dotted decoration-zinc-300 underline-offset-2',
    className
  )

  const inner = micro ? (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none',
        'bg-zinc-50 text-zinc-500',
        hasSchedule && 'ring-1 ring-zinc-200/80',
        triggerClass
      )}
    >
      {label}
    </span>
  ) : (
    <Badge variant={variant} className={cn('font-normal', triggerClass)}>
      {label}
    </Badge>
  )

  if (!hasSchedule || !schedules) {
    return inner
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex border-0 bg-transparent p-0 text-left"
          aria-label={tooltipText}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={() => setOpen((v) => !v)}
        >
          {inner}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-auto max-w-[18rem] border-zinc-200 p-2.5 shadow-lg"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">租赁档期</p>
        <ScheduleTooltipBody schedules={schedules} />
      </PopoverContent>
    </Popover>
  )
}
