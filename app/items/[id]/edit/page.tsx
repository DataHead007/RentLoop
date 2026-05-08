import { ItemForm } from '@/components/items/ItemForm'

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">编辑资产</h1>
        <p className="text-muted-foreground">修改设备信息</p>
      </div>
      <ItemForm itemId={id} />
    </div>
  )
}