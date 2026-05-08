'use client'

import { useState, useRef, useEffect } from 'react'
import { getSiliconflowApiKey } from '@/lib/settings/storageKeys'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, XCircle, Truck, Loader2, Sparkles, MapPin } from 'lucide-react'
import Image from 'next/image'
import type { Order } from '@/lib/types/database'

interface ShippingDialogProps {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * 压缩图片，在保证清晰度的前提下减小文件大小
 * @param file 原始图片文件
 * @param maxWidth 最大宽度（默认 1920px）
 * @param maxHeight 最大高度（默认 1920px）
 * @param quality 图片质量 0-1（默认 0.85）
 * @returns 压缩后的 Blob
 */
async function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        // 计算压缩后的尺寸
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = (height * maxWidth) / width
            width = maxWidth
          } else {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }

        // 创建 Canvas 进行压缩
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('无法创建 Canvas 上下文'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // 转换为 Blob，确保使用正确的 MIME 类型
        const mimeType = file.type || 'image/jpeg'
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('图片压缩失败，请尝试使用其他图片格式'))
              return
            }
            resolve(blob)
          },
          mimeType,
          quality
        )
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

export function ShippingDialog({ order, open, onOpenChange, onSuccess }: ShippingDialogProps) {
  const hasExistingFees = (order?.shipping_fees?.length ?? 0) > 0
  const existingTotalCost = hasExistingFees
    ? (order.shipping_fees as any[]).reduce((sum: number, f: any) => sum + (Number(f.amount) || 0), 0)
    : 0

  const [loading, setLoading] = useState(false)
  const [shippingType, setShippingType] = useState<'outbound' | 'pickup'>('outbound')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI 推荐发货时间
  const [shipSuggestion, setShipSuggestion] = useState<{
    distanceCategory: string
    sfDays: number
    standardDays: number
    recommendShipBy: string
    suggestedExpress: string
    reason: string
  } | null>(null)
  const [shipSuggestionLoading, setShipSuggestionLoading] = useState(false)

  // 打开对话框时，根据订单与当前发货类型同步运费输入框（同类型已有则预填该笔金额，否则为空）
  useEffect(() => {
    if (open && order) {
      const fees = (order.shipping_fees as any[]) || []
      const sameTypeFee = fees.find((f: any) => f.shipping_type === shippingType)
      const amount = sameTypeFee != null ? Number(sameTypeFee.amount) || 0 : 0
      setShippingCost(amount > 0 ? String(amount) : '')
      setShipSuggestion(null)
    }
  }, [open, order?.id, order?.shipping_fees, shippingType])

  const fetchShipSuggestion = async () => {
    const address = order?.customer_address?.trim()
    if (!address) {
      setError('订单暂无收货地址，无法推荐')
      return
    }
    setShipSuggestionLoading(true)
    setError(null)
    try {
      const apiKey = getSiliconflowApiKey()
      const res = await fetch('/api/ai/suggest-ship-date', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-SiliconFlow-Api-Key': apiKey } : {}),
        },
        body: JSON.stringify({
          origin: '上海市',
          destinationAddress: address,
          startDate: order.start_date,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '获取推荐失败')
      setShipSuggestion(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取推荐失败')
    } finally {
      setShipSuggestionLoading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件')
      return
    }

    // 验证文件大小（限制 10MB，压缩后应该会变小）
    if (file.size > 10 * 1024 * 1024) {
      setError('图片大小不能超过 10MB')
      return
    }

    setError(null)

    try {
      // 如果文件大于 1MB，进行压缩
      let processedFile: File | Blob = file
      if (file.size > 1024 * 1024) {
        // 显示压缩提示
        setCompressing(true)
        const compressedBlob = await compressImage(file)
        processedFile = compressedBlob
        setCompressing(false)
        
        // 转换为 File 对象以便后续上传
        const compressedFile = new File(
          [compressedBlob],
          file.name,
          { type: file.type || 'image/jpeg' }
        )
        setImageFile(compressedFile)
      } else {
        setImageFile(file)
      }

      // 创建预览（使用原始文件创建预览，压缩后的文件用于上传）
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file) // 预览使用原始文件，用户体验更好
    } catch (err) {
      console.error('图片处理失败:', err)
      setError(err instanceof Error ? err.message : '图片处理失败')
      setCompressing(false)
    }
  }

  const handleSubmit = async () => {
    // 验证必填字段
    // 如果是发货（outbound），快递单号是必填的；如果是自提（pickup），快递单号可选
    if (shippingType === 'outbound' && !trackingNumber.trim()) {
      setError('请输入快递单号')
      return
    }

    // 始终使用表单填写的运费金额
    const cost = parseFloat(shippingCost)
    if (isNaN(cost) || cost < 0) {
      setError('请输入有效的物流费用（元），可以为 0')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1. 上传发货照片（如果提供了）
      let imageUrl: string | null = null
      if (imageFile) {
        const formData = new FormData()
        formData.append('file', imageFile)
        formData.append('orderId', order.id)
        formData.append('type', 'checkout')

        const uploadResponse = await fetch('/api/upload/serial-number', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          // 尝试获取详细的错误信息
          const errorData = await uploadResponse.json().catch(() => ({}))
          const errorMessage = errorData.error || '上传发货照片失败'
          const errorDetails = errorData.details ? ` (${errorData.details})` : ''
          throw new Error(`${errorMessage}${errorDetails}`)
        }

        const uploadResult = await uploadResponse.json()
        imageUrl = uploadResult.url
      }

      // 2. 创建或更新物流费用记录
      // 注意：使用实际的数据库字段名 shipping_type 和 shipping_company
      const shippingFeeData: any = {
        order_id: order.id,
        shipping_type: shippingType, // 发货或自提
        amount: cost,
        shipping_company: '', // 可以后续添加物流公司选择
        tracking_number: trackingNumber.trim() || null, // 自提时可以为空
        shipping_date: new Date().toISOString().split('T')[0],
        notes: shippingType === 'pickup' ? '自提' : '发货',
      }

      // 检查是否已存在相同类型的物流费用记录
      // 注意：由于 TypeScript 类型定义可能有误，使用 any 类型访问
      const existingFees = order.shipping_fees?.filter(
        (fee: any) => fee.shipping_type === shippingType
      ) || []

      let shippingFeeResponse
      if (existingFees.length > 0) {
        // 更新第一条发货记录
        shippingFeeResponse = await fetch(`/api/shipping-fees/${existingFees[0].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shippingFeeData),
        })
      } else {
        // 创建新记录
        shippingFeeResponse = await fetch('/api/shipping-fees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shippingFeeData),
        })
      }

      if (!shippingFeeResponse.ok) {
        throw new Error('保存物流费用失败')
      }

      // 3. 更新订单状态和发货照片 URL（如果有照片）
      const updateData: any = {
        status: 'in_progress',
      }
      if (imageUrl) {
        updateData.checkout_snapshot_url = imageUrl
      }

      const updateResponse = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!updateResponse.ok) {
        throw new Error('更新订单状态失败')
      }

      // 成功
      onOpenChange(false)
      
      // 触发自定义事件，通知其他页面刷新统计数据
      window.dispatchEvent(new CustomEvent('orderUpdated'))
      // 同时使用 localStorage 通知其他标签页
      localStorage.setItem('orderUpdated', Date.now().toString())
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error('发货失败:', err)
      setError(err instanceof Error ? err.message : '发货失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading && !compressing) {
      setShippingType('outbound')
      setTrackingNumber('')
      setShippingCost('')
      setImageFile(null)
      setImagePreview(null)
      setError(null)
      setShipSuggestion(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            开始发货
          </DialogTitle>
          <DialogDescription>
            {hasExistingFees
              ? '可修改运费金额与快递单号后确认发货'
              : '填写物流费用与快递信息完成发货，照片可稍后在订单详情中补充'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* AI 推荐发货时间：有收货地址且为发货时展示 */}
          {shippingType === 'outbound' && order?.customer_address?.trim() && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  AI 推荐发货时间
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchShipSuggestion}
                  disabled={shipSuggestionLoading || loading || compressing}
                >
                  {shipSuggestionLoading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      生成中
                    </>
                  ) : (
                    '获取推荐'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                发货地：上海市 → 收货：{order.customer_address.slice(0, 20)}{order.customer_address.length > 20 ? '…' : ''}
              </p>
              {shipSuggestion && (
                <div className="text-sm space-y-2 pt-2 border-t">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded bg-blue-100 text-blue-800 px-2 py-0.5">距离：{shipSuggestion.distanceCategory}</span>
                    <span className="rounded bg-slate-100 text-slate-700 px-2 py-0.5">顺丰约 {shipSuggestion.sfDays} 天</span>
                    <span className="rounded bg-slate-100 text-slate-700 px-2 py-0.5">普通快递约 {shipSuggestion.standardDays} 天</span>
                  </div>
                  <p className="font-medium text-foreground">
                    建议最晚发货：<span className="text-primary">{shipSuggestion.recommendShipBy}</span>
                    {shipSuggestion.suggestedExpress && (
                      <span className="ml-2 text-muted-foreground">（推荐 {shipSuggestion.suggestedExpress}）</span>
                    )}
                  </p>
                  {shipSuggestion.reason && (
                    <p className="text-muted-foreground">{shipSuggestion.reason}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 发货类型 */}
          <div className="space-y-2">
            <Label htmlFor="shipping-type">发货类型 *</Label>
            <Select
              value={shippingType}
              onValueChange={(value: 'outbound' | 'pickup') => setShippingType(value)}
              disabled={loading || compressing}
            >
              <SelectTrigger id="shipping-type">
                <SelectValue placeholder="选择发货类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outbound">发货</SelectItem>
                <SelectItem value="pickup">自提</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {shippingType === 'pickup' ? '自提：客户自行取货，无需快递' : '发货：通过快递寄送'}
            </p>
          </div>

          {/* 快递单号 */}
          {shippingType === 'outbound' && (
            <div className="space-y-2">
              <Label htmlFor="tracking-number">快递单号 *</Label>
              <Input
                id="tracking-number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="请输入快递单号"
                disabled={loading || compressing}
              />
            </div>
          )}

          {/* 快递费 - 始终显示，便于快速发货时填写或修改 */}
          <div className="space-y-2">
            <Label htmlFor="shipping-cost">
              物流费用 (¥) *
            </Label>
            <Input
              id="shipping-cost"
              type="number"
              step="0.01"
              min="0"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
              placeholder="0.00"
              disabled={loading || compressing}
            />
            <p className="text-xs text-muted-foreground">
              {shippingType === 'pickup'
                ? '自提或到付时填 0'
                : '发货产生的运费，到付可填 0；确认完成后会在交易记录中记为支出'}
            </p>
          </div>

          {/* 上传发货照片 - 已有运费时可跳过，界面更简洁 */}
          {!hasExistingFees && (
          <div className="space-y-2">
            <Label htmlFor="shipping-image">发货照片（可选）</Label>
            <div className="space-y-4">
              {compressing && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>正在压缩图片...</AlertDescription>
                </Alert>
              )}
              {imagePreview ? (
                <div className="relative w-full h-64 border rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={imagePreview}
                    alt="发货照片预览"
                    fill
                    className="object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setImageFile(null)
                      setImagePreview(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                    disabled={loading || compressing}
                  >
                    删除
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => !loading && !compressing && fileInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-2">点击上传发货照片</p>
                  <p className="text-xs text-muted-foreground">
                    支持 JPG、PNG 格式，最大 10MB（大图会自动压缩）
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                id="shipping-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={loading || compressing}
              />
              {!imagePreview && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || compressing}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  选择照片
                </Button>
              )}
            </div>
          </div>
          )}

          {/* 错误提示 */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading || compressing}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || compressing}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : (
              '确认发货'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
