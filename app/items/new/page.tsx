import { ItemForm } from '@/components/items/ItemForm'

export default function NewItemPage() {
  return (
    <div className="container mx-auto min-w-0 w-full max-w-4xl px-3 py-4 sm:px-4 md:px-6 md:py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">新增资产</h1>
        <p className="text-muted-foreground">添加新的设备到资产档案</p>
      </div>
      <ItemForm />
    </div>
  )
}
