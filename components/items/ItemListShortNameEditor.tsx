'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Loader2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getItemListDisplayName, hasItemShortName } from '@/lib/items/displayName'

type ItemListShortNameEditorProps = {
  itemId: string
  fullName: string
  shortName: string | null
  subtitle?: string | null
  onSaved: (shortName: string | null) => void
  className?: string
  /** 桌面表格已有「详情」列时可关闭 */
  showDetailLink?: boolean
}

export function ItemListShortNameEditor({
  itemId,
  fullName,
  shortName,
  subtitle,
  onSaved,
  className,
  showDetailLink = true,
}: ItemListShortNameEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(shortName?.trim() ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(shortName?.trim() ?? '')
  }, [shortName, editing])

  const save = useCallback(async () => {
    const next = draft.trim() || null
    const prev = shortName?.trim() || null
    if (next === prev) {
      setEditing(false)
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ short_name: next }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '保存简称失败')
      }
      onSaved(next)
      setEditing(false)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : '保存简称失败')
      setDraft(shortName?.trim() ?? '')
    } finally {
      setSaving(false)
    }
  }, [draft, itemId, onSaved, shortName])

  const displayName = getItemListDisplayName({ name: fullName, short_name: shortName })
  const usingShort = hasItemShortName({ short_name: shortName })

  if (editing) {
    return (
      <div
        className={cn('min-w-0', className)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void save()
              }
              if (e.key === 'Escape') {
                setDraft(shortName?.trim() ?? '')
                setEditing(false)
              }
            }}
            placeholder="输入简称，如 S5M2、2870"
            disabled={saving}
            className="h-8 min-w-0 flex-1 text-sm font-medium"
            autoFocus
          />
          {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : null}
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-zinc-400" title={fullName}>
          全名：{fullName}
        </p>
      </div>
    )
  }

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group flex min-w-0 max-w-full items-center gap-1 rounded-md text-left font-medium text-foreground hover:bg-zinc-50"
          title={usingShort ? '点击编辑简称' : '点击设置简称，列表将显示简称'}
        >
          <span className="truncate">{displayName}</span>
          <Pencil className="h-3 w-3 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
        {showDetailLink ? (
          <Link
            href={`/items/${itemId}`}
            className="shrink-0 text-xs text-zinc-400 hover:text-foreground hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            详情
          </Link>
        ) : null}
      </div>
      {usingShort ? (
        <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400" title={fullName}>
          {fullName}
        </p>
      ) : subtitle ? (
        <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">{subtitle}</p>
      ) : null}
    </div>
  )
}
