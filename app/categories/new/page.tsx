import { CategoryForm } from '@/components/categories/CategoryForm'

export default function NewCategoryPage() {
  return (
    <div className="container mx-auto min-w-0 w-full max-w-2xl px-3 pt-3 pb-4 sm:px-4 md:px-6 md:pt-4 md:pb-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">新增品类</h1>
        <p className="text-muted-foreground">添加新的设备品类分类</p>
      </div>
      <CategoryForm />
    </div>
  )
}
