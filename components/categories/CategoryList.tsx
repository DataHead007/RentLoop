'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tag, Plus, Trash2, Edit } from 'lucide-react'
import type { Category } from '@/lib/types/database'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { CategoryListMobileCard } from './CategoryListMobileCard'
import { RentalLineSelect } from '@/components/categories/RentalLineSelect'
import { getRentalLineForCategory, getRentalLineLabel, type RentalLine } from '@/lib/categories/rentalLine'

export function CategoryList() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editRentalLine, setEditRentalLine] = useState<RentalLine | ''>('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    try {
      setLoading(true)
      const response = await fetch('/api/categories')
      if (!response.ok) {
        const err = await response.json().catch(() => ({} as { error?: string }))
        throw new Error(err.error || '品类加载失败')
      }
      const data = await response.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load categories:', error)
      alert(error instanceof Error ? error.message : '品类加载失败，请重试')
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!categoryToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/categories?id=${categoryToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '删除失败')
      }

      await loadCategories()
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
    } catch (error) {
      console.error('Failed to delete category:', error)
      alert(error instanceof Error ? error.message : '删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  function handleEditClick(category: Category) {
    setCategoryToEdit(category)
    setEditName(category.name)
    setEditDescription(category.description || '')
    setEditRentalLine(getRentalLineForCategory(category))
    setEditDialogOpen(true)
  }

  async function handleUpdate() {
    if (!categoryToEdit || !editName.trim()) {
      alert('请输入品类名称')
      return
    }

    setUpdating(true)
    try {
      const response = await fetch(`/api/categories/${categoryToEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          rental_line: editRentalLine || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '更新失败')
      }

      await loadCategories()
      setEditDialogOpen(false)
      setCategoryToEdit(null)
      setEditName('')
      setEditDescription('')
      setEditRentalLine('')
    } catch (error) {
      console.error('Failed to update category:', error)
      alert(error instanceof Error ? error.message : '更新失败，请重试')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">品类管理</h2>
          <p className="text-sm text-muted-foreground sm:text-base">管理设备品类分类</p>
        </div>
        <Button asChild className="w-full shrink-0 sm:w-auto">
          <Link href="/categories/new">
            <Plus className="mr-2 h-4 w-4" />
            新增品类
          </Link>
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Tag className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">暂无品类</h3>
                <p className="text-muted-foreground">开始添加你的第一个品类吧</p>
              </div>
              <Button asChild>
                <Link href="/categories/new">
                  <Plus className="mr-2 h-4 w-4" />
                  新增品类
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>品类列表</CardTitle>
            <CardDescription>共 {categories.length} 个品类</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 px-4 pb-6 pt-0 sm:px-6">
            <div className="space-y-3 lg:hidden">
              {categories.map((category) => (
                <CategoryListMobileCard
                  key={category.id}
                  category={category}
                  onEdit={handleEditClick}
                  onDelete={(c) => {
                    setCategoryToDelete(c)
                    setDeleteDialogOpen(true)
                  }}
                />
              ))}
            </div>
            <div className="hidden min-w-0 lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>品类名称</TableHead>
                    <TableHead>业务线</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getRentalLineLabel(getRentalLineForCategory(category))}
                      </TableCell>
                      <TableCell>{category.description || '-'}</TableCell>
                      <TableCell>{new Date(category.created_at).toLocaleDateString('zh-CN')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditClick(category)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCategoryToDelete(category)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑品类</DialogTitle>
            <DialogDescription>
              修改品类信息，所有关联的资产将自动更新显示。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">品类名称 *</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="例如：PS5游戏主机"
                required
              />
            </div>
            <RentalLineSelect
              value={editRentalLine}
              onChange={setEditRentalLine}
              required
            />
            <div className="space-y-2">
              <Label htmlFor="edit-description">描述</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="品类描述信息（可选）"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false)
                setCategoryToEdit(null)
                setEditName('')
                setEditDescription('')
                setEditRentalLine('')
              }}
              disabled={updating}
            >
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除品类 "{categoryToDelete?.name}" 吗？
              <br />
              <span className="text-destructive font-medium">
                注意：如果该品类下还有设备，将无法删除。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
