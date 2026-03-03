'use client'

import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Upload, CheckCircle, XCircle, Camera, ExternalLink } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import type { Order } from '@/lib/types/database'

interface CheckinDialogProps {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CheckinDialog({ order, open, onOpenChange, onSuccess }: CheckinDialogProps) {
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 兼容旧设计（单个设备）和新设计（多个订单项）
  const item = (order as any).item // 旧设计：单个设备
  const orderItems = order.order_items || [] // 新设计：多个订单项
  // 如果只有一个订单项，使用该订单项的设备信息
  const primaryItem = orderItems.length === 1 ? orderItems[0]?.item : item
  const expectedSerialNumber = primaryItem?.serial_number || ''
  const checkoutImage = order.checkout_snapshot_url

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件')
      return
    }

    // 验证文件大小（限制 5MB）
    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB')
      return
    }

    setImageFile(file)
    setError(null)

    // 创建预览
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    // 移除必填验证：序列号照片现在是可选的
    // if (!imageFile) {
    //   setError('请先选择序列号照片')
    //   return
    // }

    setLoading(true)
    setError(null)

    try {
      let imageUrl: string | null = null

      // 如果有上传照片，则上传
      if (imageFile) {
        const formData = new FormData()
        formData.append('file', imageFile)
        formData.append('orderId', order.id)
        formData.append('type', 'checkin')

        const uploadResponse = await fetch('/api/upload/serial-number', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          throw new Error('上传图片失败')
        }

        const result = await uploadResponse.json()
        imageUrl = result.url
      }

      // 更新订单状态和收货照片（如果有）
      const updateResponse = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(imageUrl && { checkin_snapshot_url: imageUrl }),
          status: 'completed',
        }),
      })

      if (!updateResponse.ok) {
        throw new Error('更新订单失败')
      }

      // 更新设备状态为可用（如果有多个订单项，更新所有设备）
      const itemsToUpdate = orderItems.length > 0 
        ? orderItems.map(oi => oi.item).filter(Boolean)
        : (primaryItem ? [primaryItem] : [])
      
      for (const deviceItem of itemsToUpdate) {
        if (deviceItem?.id) {
          await fetch(`/api/items/${deviceItem.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'available',
            }),
          })
        }
      }

      onOpenChange(false)
      
      // 触发自定义事件，通知其他页面刷新统计数据
      window.dispatchEvent(new CustomEvent('orderUpdated'))
      // 同时使用 localStorage 通知其他标签页
      localStorage.setItem('orderUpdated', Date.now().toString())
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error('Check-in failed:', err)
      setError(err instanceof Error ? err.message : '收货失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setImageFile(null)
      setImagePreview(null)
      setError(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            收货 - 序列号核对
          </DialogTitle>
          <DialogDescription>
            请拍摄设备序列号照片，系统将进行核对以确保设备未被调包
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 预期序列号显示 */}
          <div className="space-y-2">
            <Label>预期序列号</Label>
            <div className="flex items-center gap-2">
              <code className="px-3 py-2 bg-muted rounded-md font-mono text-sm flex-1">
                {expectedSerialNumber || '未设置序列号'}
              </code>
              {expectedSerialNumber ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  {/* 如果有设备ID，显示添加序列号的链接 */}
                  {primaryItem?.id && (
                    <Link href={`/items/${primaryItem.id}/edit`} target="_blank">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        添加序列号
                      </Button>
                    </Link>
                  )}
                </>
              )}
            </div>
            {/* 如果订单有多个设备，显示所有设备的序列号 */}
            {orderItems.length > 1 && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-muted-foreground">订单包含多个设备：</p>
                {orderItems.map((orderItem) => {
                  const deviceItem = orderItem.item
                  const deviceSerialNumber = deviceItem?.serial_number || ''
                  return (
                    <div key={orderItem.id} className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{deviceItem?.name || '设备'}:</span>
                      <code className="px-2 py-1 bg-muted rounded font-mono text-xs flex-1">
                        {deviceSerialNumber || '未设置序列号'}
                      </code>
                      {!deviceSerialNumber && deviceItem?.id && (
                        <Link href={`/items/${deviceItem.id}/edit`} target="_blank">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                          >
                            <ExternalLink className="h-3 w-3" />
                            添加
                          </Button>
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 发货时的序列号照片（参考） */}
          {checkoutImage && (
            <div className="space-y-2">
              <Label>发货时拍摄的序列号照片（参考）</Label>
              <div className="relative w-full h-48 border rounded-lg overflow-hidden bg-muted">
                <Image
                  src={checkoutImage}
                  alt="发货时序列号"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          )}

          {/* 上传收货时的序列号照片 */}
          <div className="space-y-2">
            <Label htmlFor="checkin-image">收货时序列号照片（可选）</Label>
            <div className="space-y-4">
              {imagePreview ? (
                <div className="relative w-full h-64 border rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={imagePreview}
                    alt="收货时序列号预览"
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
                  >
                    删除
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-2">点击上传序列号照片</p>
                  <p className="text-xs text-muted-foreground">
                    支持 JPG、PNG 格式，最大 5MB
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                id="checkin-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {!imagePreview && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  选择照片
                </Button>
              )}
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 警告提示 */}
          {!expectedSerialNumber && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                该设备未设置序列号，无法进行自动核对。请手动确认设备是否正确。
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={loading}
          >
            {loading ? '处理中...' : '确认收货'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
