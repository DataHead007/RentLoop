'use client'

import { useEffect, useMemo, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const EMPTY_VALUE = '__empty__'
const CUSTOM_TRIGGER = '__custom__'
/** 默认整点列表从 06:00 起；00:00–05:59 仅在自定义里选 */
const PRIMARY_HOUR_START = 6

function buildPrimaryHourlyOptions(): string[] {
  return Array.from({ length: 24 - PRIMARY_HOUR_START }, (_, i) => {
    const h = i + PRIMARY_HOUR_START
    return `${String(h).padStart(2, '0')}:00`
  })
}

function buildTenMinuteOptions(): string[] {
  const options: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 10) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return options
}

const PRIMARY_HOURLY_OPTIONS = buildPrimaryHourlyOptions()
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

export function isOnTheHour(value?: string | null): boolean {
  const hm = normalizeTimeToHm(value)
  return !!hm && hm.endsWith(':00')
}

function getHour(value?: string | null): number | null {
  const hm = normalizeTimeToHm(value)
  if (!hm) return null
  return Number(hm.split(':')[0])
}

/** 凌晨 0 点–5 点 59 分，默认整点列表不展示 */
export function isEarlyMorningTime(value?: string | null): boolean {
  const hour = getHour(value)
  return hour !== null && hour < PRIMARY_HOUR_START
}

function needsCustomTimePicker(value?: string | null): boolean {
  const hm = normalizeTimeToHm(value)
  if (!hm) return false
  return !isOnTheHour(hm) || isEarlyMorningTime(hm)
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
 * 羽毛球等服务时间：默认 06:00–23:00 整点；凌晨时段与非整点在自定义（10 分钟）里选。
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
  const needsCustom = needsCustomTimePicker(normalized)
  const [customMode, setCustomMode] = useState(needsCustom)

  useEffect(() => {
    if (needsCustom) setCustomMode(true)
  }, [needsCustom])

  const customOptions = useMemo(() => {
    if (normalized && !TEN_MINUTE_OPTIONS.includes(normalized)) {
      return [normalized, ...TEN_MINUTE_OPTIONS]
    }
    return TEN_MINUTE_OPTIONS
  }, [normalized])

  const hourlySelectValue = useMemo(() => {
    if (!normalized) return allowEmpty ? EMPTY_VALUE : undefined
    if (isOnTheHour(normalized) && !isEarlyMorningTime(normalized)) return normalized
    return CUSTOM_TRIGGER
  }, [normalized, allowEmpty])

  const handleBackToHourly = () => {
    if (!normalized) {
      setCustomMode(false)
      return
    }
    const [hStr, mStr] = normalized.split(':')
    const h = Number(hStr)
    if (h < PRIMARY_HOUR_START) {
      onChange('06:00')
      setCustomMode(false)
      return
    }
    const snapped = mStr === '00' ? normalized : `${hStr}:00`
    onChange(snapped)
    setCustomMode(false)
  }

  if (customMode) {
    return (
      <div className="space-y-1.5">
        <Select value={normalized || undefined} onValueChange={(v) => onChange(v)}>
          <SelectTrigger id={id} className={cn(className)}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {customOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={handleBackToHourly}
        >
          {isEarlyMorningTime(normalized) ? '改回常用整点（06:00 起）' : '改回整点选择'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Select
        value={hourlySelectValue}
        onValueChange={(v) => {
          if (v === EMPTY_VALUE) {
            onChange('')
            return
          }
          if (v === CUSTOM_TRIGGER) {
            setCustomMode(true)
            if (!normalized) onChange('19:00')
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
          {PRIMARY_HOURLY_OPTIONS.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_TRIGGER}>自定义时间（含凌晨 / 10 分钟）</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
