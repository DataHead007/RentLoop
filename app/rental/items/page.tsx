import { Suspense } from 'react'
import { ItemList } from '@/components/items/ItemList'

export default function RentalItemsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded" />}>
      <ItemList />
    </Suspense>
  )
}

