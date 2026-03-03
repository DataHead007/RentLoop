import { ItemForm } from '@/components/items/ItemForm'

export default function NewItemPage() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">新增资产</h1>
        <p className="text-muted-foreground">添加新的设备到资产档案</p>
      </div>
      <ItemForm />
    </div>
  )
}
