'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { CalendarIcon, Loader2, Upload, X, FileText, Plus, Edit, Sparkles, Link as LinkIcon, Image as ImageIcon } from 'lucide-react'
import { formatDateShort, formatDateToLocalString } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/types/database'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getSiliconflowApiKey } from '@/lib/settings/storageKeys'

interface ItemFormData {
  category_id: string
  name: string
  short_name: string
  brand: string
  model: string
  serial_number: string
  mount: string
  purchase_price: number
  purchase_date: Date | undefined
  sold_price: number | null
  sale_date: Date | undefined
  status: 'available' | 'rented' | 'in_use' | 'maintenance' | 'retired' | 'sold'
  notes: string
}

interface AiParsedItem {
  name?: string
  brand?: string
  model?: string
  category_hint?: string
  serial_number?: string
  purchase_price_hint?: number
  notes?: string
  confidence?: number
}

interface HistoricalIncomeData {
  amount: number
  transaction_date: Date | undefined
  description: string
}

interface ItemFormProps {
  itemId?: string
  onSuccess?: () => void
}

export function ItemForm({ itemId, onSuccess }: ItemFormProps) {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadingInvoice, setUploadingInvoice] = useState(false)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [historicalIncomes, setHistoricalIncomes] = useState<HistoricalIncomeData[]>([])
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [editingIncomeIndex, setEditingIncomeIndex] = useState<number | null>(null)
  const [aiImageLoading, setAiImageLoading] = useState(false)
  const [aiUrlLoading, setAiUrlLoading] = useState(false)
  const [aiUrl, setAiUrl] = useState('')
  const [aiResult, setAiResult] = useState<AiParsedItem | null>(null)
  const [newIncome, setNewIncome] = useState<HistoricalIncomeData>({
    amount: 0,
    transaction_date: undefined,
    description: '',
  })
  const [formData, setFormData] = useState<ItemFormData>({
    category_id: '',
    name: '',
    short_name: '',
    brand: '',
    model: '',
    serial_number: '',
    mount: '',
    purchase_price: 0,
    purchase_date: undefined,
    sold_price: null,
    sale_date: undefined,
    status: 'available',
    notes: '',
  })

  // 常用卡口列表
  const commonMounts = [
    'Canon EF',
    'Canon EF-S',
    'Canon RF',
    'Nikon F',
    'Nikon Z',
    'Sony E',
    'Sony FE',
    'Sony A',
    'Fujifilm X',
    'Fujifilm GFX',
    'Panasonic L',
    'Olympus M.Zuiko',
    'Leica M',
    'Leica L',
    'Pentax K',
    'Sigma SA',
    'Micro Four Thirds',
    '其他',
  ]

  // 判断是否为镜头品类
  const selectedCategory = categories.find(cat => cat.id === formData.category_id)
  const isLensCategory = selectedCategory?.name?.includes('镜头') || selectedCategory?.name?.includes('镜')

  useEffect(() => {
    loadCategories()
    if (itemId) {
      loadItem()
    }
  }, [itemId])

  // 自动更新状态：当填写了出售价格和出售日期时，自动设置为"已售出"
  useEffect(() => {
    // 如果同时填写了出售价格（>0）和出售日期，自动将状态设置为"已售出"
    if (formData.sold_price && formData.sold_price > 0 && formData.sale_date) {
      if (formData.status !== 'sold') {
        setFormData(prev => ({ ...prev, status: 'sold' }))
      }
    }
    // 注意：如果清空了出售信息，我们不自动恢复状态，让用户手动选择
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.sold_price, formData.sale_date])

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (typeof result !== 'string') {
          reject(new Error('图片读取失败'))
          return
        }
        const raw = result.includes(',') ? result.split(',')[1] : result
        resolve(raw)
      }
      reader.onerror = () => reject(new Error('图片读取失败'))
      reader.readAsDataURL(file)
    })
  }

  function findCategoryIdByHint(hint?: string): string | undefined {
    if (!hint?.trim()) return undefined
    const q = hint.trim().toLowerCase()
    const exact = categories.find((c) => c.name?.toLowerCase() === q)
    if (exact) return exact.id
    const include = categories.find((c) => c.name?.toLowerCase().includes(q) || q.includes(c.name?.toLowerCase() || ''))
    return include?.id
  }

  function applyAiParsedToForm(parsed: AiParsedItem) {
    const matchedCategoryId = findCategoryIdByHint(parsed.category_hint)
    setFormData((prev) => ({
      ...prev,
      category_id: matchedCategoryId || prev.category_id,
      name: parsed.name || prev.name,
      brand: parsed.brand || prev.brand,
      model: parsed.model || prev.model,
      serial_number: parsed.serial_number || prev.serial_number,
      purchase_price:
        typeof parsed.purchase_price_hint === 'number' && parsed.purchase_price_hint > 0
          ? parsed.purchase_price_hint
          : prev.purchase_price,
      notes:
        parsed.notes && parsed.notes.trim()
          ? prev.notes?.trim()
            ? `${prev.notes}\n${parsed.notes.trim()}`
            : parsed.notes.trim()
          : prev.notes,
    }))
  }

  async function handleAiImageParse(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAiImageLoading(true)
    try {
      const imageBase64 = await fileToBase64(file)
      const apiKey = getSiliconflowApiKey()
      const res = await fetch('/api/ai/parse-item-from-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-SiliconFlow-Api-Key': apiKey } : {}),
        },
        body: JSON.stringify({
          imageBase64,
          imageMimeType: file.type || 'image/jpeg',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || '图片识别失败，请重试')
      }
      const data = (await res.json()) as AiParsedItem
      setAiResult(data)
      if (!data || Object.keys(data).length === 0) {
        alert('未识别到可用信息，请换一张更清晰的商品图或铭牌图')
      }
    } catch (error) {
      console.error('AI image parse failed:', error)
      alert(error instanceof Error ? error.message : '图片识别失败，请重试')
    } finally {
      setAiImageLoading(false)
      e.target.value = ''
    }
  }

  async function handleAiUrlParse() {
    if (!aiUrl.trim()) {
      alert('请先输入产品链接')
      return
    }
    setAiUrlLoading(true)
    try {
      const apiKey = getSiliconflowApiKey()
      const res = await fetch('/api/ai/parse-item-from-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-SiliconFlow-Api-Key': apiKey } : {}),
        },
        body: JSON.stringify({ url: aiUrl.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || '链接解析失败，请重试')
      }
      const data = (await res.json()) as AiParsedItem
      setAiResult(data)
      if (!data || Object.keys(data).length === 0) {
        alert('未识别到可用信息，请尝试更具体的产品页链接')
      }
    } catch (error) {
      console.error('AI url parse failed:', error)
      alert(error instanceof Error ? error.message : '链接解析失败，请重试')
    } finally {
      setAiUrlLoading(false)
    }
  }

  async function loadCategories() {
    try {
      const response = await fetch('/api/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')
      const data = await response.json()
      setCategories(data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  async function loadItem() {
    if (!itemId) return
    
    try {
      const response = await fetch(`/api/items/${itemId}`)
      if (!response.ok) throw new Error('Failed to fetch item')
      const item = await response.json()
      
      setFormData({
        category_id: item.category_id || '',
        name: item.name || '',
        short_name: item.short_name || '',
        brand: item.brand || '',
        model: item.model || '',
        serial_number: item.serial_number || '',
        mount: item.mount || '',
        purchase_price: item.purchase_price || 0,
        purchase_date: item.purchase_date ? new Date(item.purchase_date) : undefined,
        sold_price: item.sold_price || null,
        sale_date: item.sale_date ? new Date(item.sale_date) : undefined,
        status: item.status || 'available',
        notes: item.notes || '',
      })
      setInvoiceUrl(item.purchase_invoice_url || null)
    } catch (error) {
      console.error('Failed to load item:', error)
      alert('加载资产信息失败，请重试')
    }
  }

  async function handleInvoiceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingInvoice(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload/invoice', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '上传失败')
      }

      const { url } = await response.json()
      setInvoiceUrl(url)
    } catch (error) {
      console.error('Failed to upload invoice:', error)
      alert(error instanceof Error ? error.message : '上传发票失败，请重试')
    } finally {
      setUploadingInvoice(false)
      // 清空 input，允许重复选择同一文件
      e.target.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!formData.category_id || !formData.name || formData.purchase_price === undefined || formData.purchase_price === null) {
      alert('请填写所有必填字段（品类、设备名称、购买价格）')
      return
    }

    if (formData.purchase_price < 0) {
      alert('购买价格不能为负数')
      return
    }

    setLoading(true)
    try {
      const itemData = {
        category_id: formData.category_id,
        name: formData.name,
        short_name: formData.short_name?.trim() || null,
        brand: formData.brand || null,
        model: formData.model || null,
        serial_number: formData.serial_number || null,
        mount: formData.mount || null,
        purchase_price: formData.purchase_price,
        purchase_date: formData.purchase_date 
          ? formatDateToLocalString(formData.purchase_date)
          : null,
        purchase_invoice_url: invoiceUrl,
        sold_price: formData.sold_price || null,
        sale_date: formData.sale_date 
          ? formatDateToLocalString(formData.sale_date)
          : null,
        status: formData.status,
        notes: formData.notes || null,
      }

      const url = itemId ? `/api/items/${itemId}` : '/api/items'
      const method = itemId ? 'PATCH' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${itemId ? 'update' : 'create'} item`)
      }

      const createdItem = await response.json()
      const newItemId = createdItem.id || itemId

      // 如果有历史收入，创建交易记录
      if (historicalIncomes.length > 0 && newItemId) {
        for (const income of historicalIncomes) {
          if (income.amount > 0 && income.transaction_date) {
            try {
              await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  item_id: newItemId,
                  type: 'income',
                  amount: income.amount,
                  category: '租金收入',
                  description: income.description || `${formData.name} 历史收入`,
                  transaction_date: formatDateToLocalString(income.transaction_date),
                }),
              })
            } catch (error) {
              console.error('Failed to create historical income transaction:', error)
              // 不阻止主流程，只记录错误
            }
          }
        }
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(newItemId ? `/items/${newItemId}` : '/items')
      }
    } catch (error) {
      console.error('Failed to create item:', error)
      alert(error instanceof Error ? error.message : '创建资产失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{itemId ? '编辑设备信息' : '设备基本信息'}</CardTitle>
          <CardDescription>{itemId ? '修改设备的基本信息' : '填写设备的基本信息'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!itemId && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                AI 快速录入（图片识别 / 产品链接）
              </div>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  id="ai-item-image"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAiImageParse}
                  disabled={aiImageLoading || aiUrlLoading}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={aiImageLoading || aiUrlLoading}
                  onClick={() => document.getElementById('ai-item-image')?.click()}
                >
                  {aiImageLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="mr-2 h-4 w-4" />
                  )}
                  识别图片
                </Button>
                <div className="flex flex-1 gap-2">
                  <Input
                    value={aiUrl}
                    onChange={(e) => setAiUrl(e.target.value)}
                    placeholder="粘贴官网/电商产品链接"
                    disabled={aiImageLoading || aiUrlLoading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAiUrlParse}
                    disabled={aiImageLoading || aiUrlLoading}
                  >
                    {aiUrlLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LinkIcon className="mr-2 h-4 w-4" />
                    )}
                    解析链接
                  </Button>
                </div>
              </div>
              {aiResult && (
                <div className="rounded-md border bg-background p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">识别结果（可编辑后回填）</p>
                    {typeof aiResult.confidence === 'number' && (
                      <span className="text-muted-foreground">
                        置信度 {Math.round(aiResult.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="grid gap-1 md:grid-cols-2 text-muted-foreground">
                    <p>名称：{aiResult.name || '-'}</p>
                    <p>品牌：{aiResult.brand || '-'}</p>
                    <p>型号：{aiResult.model || '-'}</p>
                    <p>品类建议：{aiResult.category_hint || '-'}</p>
                    <p>序列号：{aiResult.serial_number || '-'}</p>
                    <p>价格建议：{typeof aiResult.purchase_price_hint === 'number' ? `¥${aiResult.purchase_price_hint}` : '-'}</p>
                  </div>
                  {aiResult.notes && <p className="text-muted-foreground">备注建议：{aiResult.notes}</p>}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setAiResult(null)}>
                      清空结果
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        applyAiParsedToForm(aiResult)
                        alert('已回填识别结果，请检查后再保存')
                      }}
                    >
                      一键回填
                    </Button>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                建议上传清晰商品图、机身铭牌或发票截图；链接优先使用产品详情页。
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="category_id">品类 *</Label>
            <Select
              value={formData.category_id && formData.category_id.trim() !== '' ? formData.category_id : undefined}
              onValueChange={(value) => setFormData({ ...formData, category_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择品类" />
              </SelectTrigger>
              <SelectContent>
                {categories.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    暂无品类，请先在数据库中创建品类
                  </div>
                ) : (
                  categories
                    .filter((category) => {
                      // 确保 id 存在且不是空字符串
                      return category?.id && typeof category.id === 'string' && category.id.trim() !== ''
                    })
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                提示：品类需要在数据库中手动创建，或通过 API 创建
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">设备名称 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：Canon EOS R5"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="short_name">昵称/简称</Label>
            <Input
              id="short_name"
              value={formData.short_name}
              onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
              placeholder="例如：A7M4、R5，订单列表将显示此名称"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">品牌</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="例如：Canon"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">型号</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="例如：EOS R5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serial_number">序列号</Label>
            <Input
              id="serial_number"
              value={formData.serial_number}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              placeholder="用于防调包核对（建议填写）"
            />
            <p className="text-sm text-muted-foreground">
              序列号用于收货时核对设备，防止调包
            </p>
          </div>

          {isLensCategory && (
            <div className="space-y-2">
              <Label htmlFor="mount">卡口类型</Label>
              <div className="space-y-2">
                <Select
                  value={formData.mount}
                  onValueChange={(value) => {
                    if (value === '其他') {
                      setFormData({ ...formData, mount: '' })
                    } else {
                      setFormData({ ...formData, mount: value })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择卡口类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {commonMounts.map((mount) => (
                      <SelectItem key={mount} value={mount}>
                        {mount}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!formData.mount || !commonMounts.includes(formData.mount)) && (
                  <Input
                    id="mount"
                    value={formData.mount}
                    onChange={(e) => setFormData({ ...formData, mount: e.target.value })}
                    placeholder="或输入自定义卡口类型（如：Canon EF、Nikon F 等）"
                  />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                镜头类设备需要指定卡口类型，用于匹配相机系统
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">备注</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="设备备注信息（如：设备特点、使用注意事项等）"
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              可以记录设备的特殊说明、使用注意事项或其他相关信息
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>购买信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchase_price">购买价格 (¥) *</Label>
              <Input
                id="purchase_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.purchase_price === 0 ? '0' : (formData.purchase_price || '')}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '' || value === null || value === undefined) {
                    setFormData({ ...formData, purchase_price: 0 })
                  } else {
                    const numValue = parseFloat(value)
                    if (!isNaN(numValue) && numValue >= 0) {
                      setFormData({ ...formData, purchase_price: numValue })
                    }
                  }
                }}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_date">购买日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.purchase_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.purchase_date ? (
                      formatDateShort(formData.purchase_date)
                    ) : (
                      <span>选择购买日期</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.purchase_date}
                    onSelect={(date) => setFormData({ ...formData, purchase_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice">购买发票（可选）</Label>
            <div className="space-y-2">
              {invoiceUrl ? (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">发票已上传</p>
                      <a
                        href={invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        查看发票
                      </a>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setInvoiceUrl(null)}
                    disabled={uploadingInvoice}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    id="invoice"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={handleInvoiceUpload}
                    disabled={uploadingInvoice}
                  />
                  <label htmlFor="invoice">
                    <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                      {uploadingInvoice ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">上传中...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            点击上传发票（支持图片和 PDF，最大 10MB）
                          </p>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              支持上传 JPEG、PNG、WebP 图片或 PDF 文件，最大 10MB
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>出售信息（可选）</CardTitle>
          <CardDescription>如果资产已出售，请填写出售信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sold_price">出售价格 (¥)</Label>
              <Input
                id="sold_price"
                type="number"
                step="0.01"
                value={formData.sold_price || ''}
                onChange={(e) => setFormData({ ...formData, sold_price: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sale_date">出售日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.sale_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.sale_date ? (
                      formatDateShort(formData.sale_date)
                    ) : (
                      '选择出售日期'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.sale_date}
                    onSelect={(date) => setFormData({ ...formData, sale_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>状态信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status">状态</Label>
            <Select
              value={formData.status}
              onValueChange={(value: any) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">可用</SelectItem>
                <SelectItem value="rented">出租中</SelectItem>
                <SelectItem value="in_use">使用中</SelectItem>
                <SelectItem value="maintenance">维护中</SelectItem>
                <SelectItem value="retired">已退役</SelectItem>
                <SelectItem value="sold">已售出</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 历史收入录入 - 仅在创建新资产时显示 */}
      {!itemId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>历史收入（可选）</CardTitle>
                <CardDescription>如果资产已有历史收入记录，可以在此录入</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddIncome(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                添加历史收入
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {historicalIncomes.length > 0 && (
              <div className="space-y-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日期</TableHead>
                      <TableHead>金额</TableHead>
                      <TableHead>描述</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicalIncomes.map((income, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {income.transaction_date ? formatDateShort(income.transaction_date) : '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          ¥{income.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>{income.description || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // 填充编辑数据
                                setNewIncome({ ...historicalIncomes[index] })
                                setEditingIncomeIndex(index)
                                setShowAddIncome(true)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setHistoricalIncomes(historicalIncomes.filter((_, i) => i !== index))
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {showAddIncome && (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-base">
                    {editingIncomeIndex !== null ? '编辑历史收入' : '添加历史收入'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="income_amount">金额 (¥) *</Label>
                      <Input
                        id="income_amount"
                        type="number"
                        step="0.01"
                        value={newIncome.amount || ''}
                        onChange={(e) => setNewIncome({ ...newIncome, amount: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="income_date">收入日期 *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !newIncome.transaction_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newIncome.transaction_date ? (
                              formatDateShort(newIncome.transaction_date)
                            ) : (
                              '选择日期'
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={newIncome.transaction_date}
                            onSelect={(date) => setNewIncome({ ...newIncome, transaction_date: date })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="income_description">描述</Label>
                    <Input
                      id="income_description"
                      value={newIncome.description}
                      onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
                      placeholder="例如：历史收入截止到2024年12月"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddIncome(false)
                        setEditingIncomeIndex(null)
                        setNewIncome({ amount: 0, transaction_date: undefined, description: '' })
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (newIncome.amount > 0 && newIncome.transaction_date) {
                          if (editingIncomeIndex !== null) {
                            // 编辑模式：更新指定索引的记录
                            const updated = [...historicalIncomes]
                            updated[editingIncomeIndex] = { ...newIncome }
                            setHistoricalIncomes(updated)
                            setEditingIncomeIndex(null)
                          } else {
                            // 新增模式：添加到列表
                            setHistoricalIncomes([...historicalIncomes, { ...newIncome }])
                          }
                          setNewIncome({ amount: 0, transaction_date: undefined, description: '' })
                          setShowAddIncome(false)
                        } else {
                          alert('请填写金额和日期')
                        }
                      }}
                    >
                      {editingIncomeIndex !== null ? '保存' : '添加'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {historicalIncomes.length === 0 && !showAddIncome && (
              <div className="text-center text-sm text-muted-foreground py-4">
                点击"添加历史收入"按钮录入历史收入记录
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          取消
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {itemId ? '更新' : '保存'}
        </Button>
      </div>
    </form>
  )
}
