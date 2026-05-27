'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import {
  BADMINTON_MATCH_DISCIPLINES,
  BADMINTON_MATCH_PRIZE_MODES,
  BADMINTON_MATCH_PRIZE_MODE_LABELS,
  type BadmintonMatchDiscipline,
  type BadmintonMatchPrizeMode,
} from '@/lib/constants/badmintonMatch'
import {
  computeBadmintonMatchNetProfit,
  matchNetProfitIncludesInKindEstimate,
} from '@/lib/badminton/matchNetProfit'
import { formatCurrency } from '@/lib/utils/format'
import type { BadmintonMatchRecord } from '@/lib/types/database'
import { cn } from '@/lib/utils'

type FormState = {
  event_name: string
  event_date: string
  location: string
  event_time: string
  discipline: BadmintonMatchDiscipline | ''
  discipline_other: string
  result: string
  registration_fee: string
  prize_mode: BadmintonMatchPrizeMode
  prize_cash: string
  prize_in_kind_desc: string
  prize_in_kind_value: string
  reflection: string
}

function recordToFormState(record: BadmintonMatchRecord): FormState {
  return {
    event_name: record.event_name,
    event_date: record.event_date,
    location: record.location,
    event_time: record.event_time?.slice(0, 5) ?? '',
    discipline: record.discipline as BadmintonMatchDiscipline,
    discipline_other: record.discipline_other ?? '',
    result: record.result ?? '',
    registration_fee: String(record.registration_fee ?? 0),
    prize_mode: record.prize_mode,
    prize_cash: record.prize_cash != null ? String(record.prize_cash) : '',
    prize_in_kind_desc: record.prize_in_kind_desc ?? '',
    prize_in_kind_value:
      record.prize_in_kind_value != null ? String(record.prize_in_kind_value) : '',
    reflection: record.reflection ?? '',
  }
}

function emptyFormState(): FormState {
  return {
    event_name: '',
    event_date: '',
    location: '',
    event_time: '',
    discipline: '',
    discipline_other: '',
    result: '',
    registration_fee: '0',
    prize_mode: 'none',
    prize_cash: '',
    prize_in_kind_desc: '',
    prize_in_kind_value: '',
    reflection: '',
  }
}

type BadmintonMatchFormProps = {
  matchId?: string
  initialRecord?: BadmintonMatchRecord
}

export function BadmintonMatchForm({ matchId, initialRecord }: BadmintonMatchFormProps) {
  const router = useRouter()
  const isEdit = Boolean(matchId)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>(() =>
    initialRecord ? recordToFormState(initialRecord) : emptyFormState()
  )

  const previewNet = useMemo(() => {
    return computeBadmintonMatchNetProfit({
      registration_fee: parseFloat(form.registration_fee) || 0,
      prize_mode: form.prize_mode,
      prize_cash: parseFloat(form.prize_cash) || 0,
      prize_in_kind_value: parseFloat(form.prize_in_kind_value) || 0,
    })
  }, [form])

  const showInKindHint = matchNetProfitIncludesInKindEstimate(form.prize_mode)

  function buildPayload() {
    return {
      event_name: form.event_name.trim(),
      event_date: form.event_date.trim(),
      location: form.location.trim(),
      event_time: form.event_time.trim() || null,
      discipline: form.discipline,
      discipline_other: form.discipline === '其他' ? form.discipline_other.trim() || null : null,
      result: form.result.trim() || null,
      registration_fee: parseFloat(form.registration_fee) || 0,
      prize_mode: form.prize_mode,
      prize_cash:
        form.prize_mode === 'cash' || form.prize_mode === 'both'
          ? parseFloat(form.prize_cash) || 0
          : null,
      prize_in_kind_desc:
        form.prize_mode === 'in_kind' || form.prize_mode === 'both'
          ? form.prize_in_kind_desc.trim() || null
          : null,
      prize_in_kind_value:
        form.prize_mode === 'in_kind' || form.prize_mode === 'both'
          ? parseFloat(form.prize_in_kind_value) || 0
          : null,
      reflection: form.reflection.trim() || null,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.event_name.trim() || !form.event_date || !form.location.trim() || !form.discipline) {
      alert('请填写比赛名称、日期、地点和项目')
      return
    }
    if (form.discipline === '其他' && !form.discipline_other.trim()) {
      alert('选择「其他」时请说明项目')
      return
    }

    setLoading(true)
    try {
      const url = isEdit ? `/api/badminton/matches/${matchId}` : '/api/badminton/matches'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || (isEdit ? '更新失败' : '创建失败'))
      }
      const saved = await res.json()
      if (saved.transaction_sync_warning) {
        alert(saved.transaction_sync_warning)
      }
      router.push(`/badminton/matches/${saved.id}`)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-5 sm:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>比赛信息</CardTitle>
          <CardDescription>记录你自己参赛的基本情况</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event_name">比赛名称 *</Label>
            <Input
              id="event_name"
              value={form.event_name}
              onChange={(e) => setForm({ ...form, event_name: e.target.value })}
              placeholder="例如：XX 杯业余公开赛"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event_date">比赛日期 *</Label>
              <Input
                id="event_date"
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_time">时间（可选）</Label>
              <Input
                id="event_time"
                type="time"
                value={form.event_time}
                onChange={(e) => setForm({ ...form, event_time: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">地点 *</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="球馆或城市"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>项目 *</Label>
              <Select
                value={form.discipline || undefined}
                onValueChange={(v) =>
                  setForm({ ...form, discipline: v as BadmintonMatchDiscipline })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {BADMINTON_MATCH_DISCIPLINES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.discipline === '其他' ? (
              <div className="space-y-2">
                <Label htmlFor="discipline_other">项目说明 *</Label>
                <Input
                  id="discipline_other"
                  value={form.discipline_other}
                  onChange={(e) => setForm({ ...form, discipline_other: e.target.value })}
                  placeholder="如：青年组男单"
                />
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="result">成绩</Label>
            <Input
              id="result"
              value={form.result}
              onChange={(e) => setForm({ ...form, result: e.target.value })}
              placeholder="如：B 组亚军、止步 16 强"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>收支</CardTitle>
          <CardDescription>报名费与奖励；奖品按估值计入本场净利</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="registration_fee">报名费（元）</Label>
            <Input
              id="registration_fee"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.registration_fee}
              onChange={(e) => setForm({ ...form, registration_fee: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>奖励</Label>
            <Select
              value={form.prize_mode}
              onValueChange={(v) =>
                setForm({ ...form, prize_mode: v as BadmintonMatchPrizeMode })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BADMINTON_MATCH_PRIZE_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {BADMINTON_MATCH_PRIZE_MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(form.prize_mode === 'cash' || form.prize_mode === 'both') && (
            <div className="space-y-2">
              <Label htmlFor="prize_cash">现金奖金（元）</Label>
              <Input
                id="prize_cash"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.prize_cash}
                onChange={(e) => setForm({ ...form, prize_cash: e.target.value })}
              />
            </div>
          )}
          {(form.prize_mode === 'in_kind' || form.prize_mode === 'both') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="prize_in_kind_desc">奖品说明 *</Label>
                <Input
                  id="prize_in_kind_desc"
                  value={form.prize_in_kind_desc}
                  onChange={(e) => setForm({ ...form, prize_in_kind_desc: e.target.value })}
                  placeholder="如：球拍一支、一桶球"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prize_in_kind_value">奖品估值（元）*</Label>
                <Input
                  id="prize_in_kind_value"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.prize_in_kind_value}
                  onChange={(e) => setForm({ ...form, prize_in_kind_value: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  主观估值，仅用于个人统计，不代表已变现收入。
                </p>
              </div>
            </>
          )}
          <div
            className={cn(
              'rounded-lg border px-3 py-2.5 text-sm',
              previewNet >= 0
                ? 'border-emerald-200/80 bg-emerald-50/50'
                : 'border-rose-200/80 bg-rose-50/50'
            )}
          >
            <span className="text-muted-foreground">本场预估净利 </span>
            <span
              className={cn(
                'font-semibold tabular-nums',
                previewNet >= 0 ? 'text-emerald-800' : 'text-rose-800'
              )}
            >
              {formatCurrency(previewNet)}
            </span>
            {showInKindHint ? (
              <span className="ml-1 text-xs text-muted-foreground">（含奖品估值）</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>比赛心得</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.reflection}
            onChange={(e) => setForm({ ...form, reflection: e.target.value })}
            placeholder="技术、体能、心态、对手特点、下次改进点…"
            rows={6}
            className="min-h-[8rem]"
          />
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => router.push(isEdit ? `/badminton/matches/${matchId}` : '/badminton/matches')}
          disabled={loading}
        >
          取消
        </Button>
        <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isEdit ? '保存' : '保存记录'}
        </Button>
      </div>
    </form>
  )
}
