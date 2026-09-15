'use client'

import { useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const EMPTY_VALUE = '__empty__'

function buildTenMinuteOptions(): string[] {
  const options: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 10) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return options
}

const TEN_MINUTE_OPTIONS = buildTenMinuteOptions()

/** 归一化为 HH:mm；无法解析则返回空字符串 */
export function normalizeTimeToHm(value?: string | null): string {
  if (!value?.trim()) return ''
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?/)
  if (!match) return ''
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return ''
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 将分钟就近对齐到 10 分钟（用于展示旧数据） */
export function snapTimeToTenMinutes(value?: string | null): string {
  const hm = normalizeTimeToHm(value)
  if (!hm) return ''
  const [hStr, mStr] = hm.split(':')
  const h = Number(hStr)
  let m = Math.round(Number(mStr) / 10) * 10
  let hour = h
  if (m === 60) {
    m = 0
    hour = (hour + 1) % 24
  }
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

interface TimeSelect10MinProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  allowEmpty?: boolean
  emptyLabel?: string
}

/**
 * 手机端原生 type=time 常忽略 step，改用固定 10 分钟档位的下拉。
 */
export function TimeSelect10Min({
  id,
  value,
  onChange,
  placeholder = '选择时间',
  className,
  allowEmpty = true,
  emptyLabel = '未设置',
}: TimeSelect10MinProps) {
  const normalized = normalizeTimeToHm(value)
  const options = useMemo(() => {
    if (normalized && !TEN_MINUTE_OPTIONS.includes(normalized)) {
      return [normalized, ...TEN_MINUTE_OPTIONS]
    }
    return TEN_MINUTE_OPTIONS
  }, [normalized])

  const selectValue = normalized || (allowEmpty ? EMPTY_VALUE : undefined)

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => {
        if (v === EMPTY_VALUE) {
          onChange('')
          return
        }
        onChange(v)
      }}
    >
      <SelectTrigger id={id} className={cn(className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {allowEmpty && <SelectItem value={EMPTY_VALUE}>{emptyLabel}</SelectItem>}
        {options.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
