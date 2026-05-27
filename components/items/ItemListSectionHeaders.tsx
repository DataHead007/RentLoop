'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** 行内 / 面包屑用微型标签 */
export function ItemListMicroBadge({
  children,
  className,
  variant = 'default',
}: {
  children: ReactNode
  className?: string
  variant?: 'default' | 'muted' | 'sold'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none',
        variant === 'default' && 'bg-zinc-100 text-zinc-600',
        variant === 'muted' && 'bg-zinc-50 text-zinc-500',
        variant === 'sold' && 'bg-zinc-100/80 text-zinc-400',
        className
      )}
    >
      {children}
    </span>
  )
}

export type ItemListBreadcrumbSegment = {
  label: string
  count?: number
  muted?: boolean
  /** 业务线 key 或 sold */
  sectionKey: string
}

type ItemListSectionBreadcrumbProps = {
  segments: ItemListBreadcrumbSegment[]
  activeSectionKey?: string | null
  onSelectSection: (sectionKey: string) => void
}

export function ItemListSectionBreadcrumb({
  segments,
  activeSectionKey,
  onSelectSection,
}: ItemListSectionBreadcrumbProps) {
  if (segments.length === 0) return null

  return (
    <nav
      aria-label="按业务线筛选"
      className="flex flex-wrap items-center gap-x-0.5 gap-y-1 px-4 py-2.5 text-[11px]"
    >
      {segments.map((seg, i) => {
        const isActive = activeSectionKey === seg.sectionKey
        return (
          <span key={seg.sectionKey} className="inline-flex items-center gap-1">
            {i > 0 ? <span className="px-0.5 text-zinc-300 select-none">/</span> : null}
            <button
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelectSection(seg.sectionKey)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors',
                'hover:bg-zinc-100 hover:text-zinc-800',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isActive && 'bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white',
                !isActive && (seg.muted ? 'text-zinc-400' : 'text-zinc-600')
              )}
            >
              <span>{seg.label}</span>
              {seg.count != null ? (
                <span
                  className={cn(
                    'tabular-nums',
                    isActive ? 'text-zinc-300' : 'text-zinc-400'
                  )}
                >
                  {seg.count}
                </span>
              ) : null}
            </button>
          </span>
        )
      })}
    </nav>
  )
}

type ItemListRowContextBadgesProps = {
  familyLabel?: string
  categoryName?: string
  statusLabel?: string
  showFamily?: boolean
  showCategory?: boolean
  showStatus?: boolean
  sold?: boolean
}

export function ItemListRowContextBadges({
  familyLabel,
  categoryName,
  statusLabel,
  showFamily,
  showCategory,
  showStatus,
  sold,
}: ItemListRowContextBadgesProps) {
  const variant = sold ? 'sold' : 'default'
  const hasAny =
    (showFamily && familyLabel) ||
    (showCategory && categoryName) ||
    (showStatus && statusLabel)

  if (!hasAny) return null

  return (
    <div className="mb-1 flex flex-wrap items-center gap-1">
      {showFamily && familyLabel ? (
        <ItemListMicroBadge variant={variant}>{familyLabel}</ItemListMicroBadge>
      ) : null}
      {showCategory && categoryName ? (
        <ItemListMicroBadge variant={variant}>{categoryName}</ItemListMicroBadge>
      ) : null}
      {showStatus && statusLabel ? (
        <ItemListMicroBadge variant={sold ? 'sold' : 'muted'}>{statusLabel}</ItemListMicroBadge>
      ) : null}
    </div>
  )
}

type ItemListStatusHeaderProps = {
  statusLabel: string
  count: number
  variant?: 'default' | 'sold'
}

export function ItemListStatusHeader({
  statusLabel,
  count,
  variant = 'default',
}: ItemListStatusHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2.5',
        variant === 'sold' ? 'text-muted-foreground' : 'text-foreground/80'
      )}
    >
      <span
        className={cn(
          'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
          variant === 'sold'
            ? 'bg-muted/60 text-muted-foreground'
            : 'bg-zinc-100 text-zinc-700'
        )}
      >
        {statusLabel}
      </span>
      <span className="text-xs tabular-nums text-zinc-400">{count} 件</span>
    </div>
  )
}

export function ItemListSoldDivider({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-3 bg-white px-4 py-5">
      <div className="h-px flex-1 bg-zinc-100" />
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        已售出 · {count}
      </span>
      <div className="h-px flex-1 bg-zinc-100" />
    </div>
  )
}
