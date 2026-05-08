import { Suspense } from 'react'
import { ItemList } from '@/components/items/ItemList'

export default function ItemsPage() {
  return (
    <div className="container mx-auto py-8">
      <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded" />}>
        <ItemList />
      </Suspense>
    </div>
  )
}
