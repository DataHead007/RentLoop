'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RENTAL_LINE_OPTIONS } from '@/lib/categories/rentalLine'
import type { RentalLine } from '@/lib/categories/rentalLine'

type RentalLineSelectProps = {
  id?: string
  value: RentalLine | ''
  onChange: (value: RentalLine) => void
  required?: boolean
  className?: string
}

export function RentalLineSelect({
  id = 'rental_line',
  value,
  onChange,
  required,
  className,
}: RentalLineSelectProps) {
  return (
    <div className={className}>
      <Label htmlFor={id}>
        业务线{required ? ' *' : ''}
      </Label>
      <Select
        value={value || undefined}
        onValueChange={(v) => onChange(v as RentalLine)}
        required={required}
      >
        <SelectTrigger id={id} className="mt-1.5 h-10">
          <SelectValue placeholder="选择业务线" />
        </SelectTrigger>
        <SelectContent>
          {RENTAL_LINE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1.5 text-xs text-muted-foreground">
        用于资产列表分组：游戏机、摄影摄像、音响、照片打印机等
      </p>
    </div>
  )
}
