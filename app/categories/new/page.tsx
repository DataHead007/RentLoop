import { CategoryForm } from '@/components/categories/CategoryForm'

export default function NewCategoryPage() {
  return (
    <div className="container mx-auto min-w-0 w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">新增品类</h1>
        <p className="text-muted-foreground">添加新的设备品类分类</p>
      </div>
      <CategoryForm />
    </div>
  )
}
