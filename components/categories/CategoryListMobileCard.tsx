'use client'

import type { Category } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Edit, Trash2 } from 'lucide-react'
import { getRentalLineForCategory, getRentalLineLabel } from '@/lib/categories/rentalLine'
import { ItemListMicroBadge } from '@/components/items/ItemListSectionHeaders'

type CategoryListMobileCardProps = {
  category: Category
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
}

export function CategoryListMobileCard({ category, onEdit, onDelete }: CategoryListMobileCardProps) {
  return (
    <article className="min-w-0 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{category.name}</span>
        <ItemListMicroBadge>{getRentalLineLabel(getRentalLineForCategory(category))}</ItemListMicroBadge>
      </div>
      <p className="mt-2 min-w-0 break-words text-sm text-muted-foreground">{category.description || '-'}</p>
      <div className="mt-2 text-xs text-muted-foreground">
        创建于 {new Date(category.created_at).toLocaleDateString('zh-CN')}
      </div>
      <div className="mt-3 flex gap-2 border-t border-border/60 pt-3">
        <Button variant="outline" size="sm" onClick={() => onEdit(category)}>
          <Edit className="mr-1 h-4 w-4" />
          编辑
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(category)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  )
}
