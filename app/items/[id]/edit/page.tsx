import { ItemForm } from '@/components/items/ItemForm'

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="container mx-auto min-w-0 w-full max-w-4xl px-3 pt-3 pb-4 sm:px-4 md:px-6 md:pt-4 md:pb-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">编辑资产</h1>
        <p className="text-muted-foreground">修改设备信息</p>
      </div>
      <ItemForm itemId={id} />
    </div>
  )
}