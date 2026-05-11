import { Suspense } from 'react'
import { ItemList } from '@/components/items/ItemList'

export default function ItemsPage() {
  return (
    <div className="container mx-auto min-w-0 max-w-full py-8">
      <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded" />}>
        <ItemList />
      </Suspense>
    </div>
  )
}
