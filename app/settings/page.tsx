'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Key, Globe, Eye, EyeOff } from 'lucide-react'
import { STORAGE_KEYS } from '@/lib/settings/storageKeys'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const [tab, setTab] = useState<'api' | 'ai'>('ai')
  const [siliconflowKey, setSiliconflowKey] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [showSiliconflowKey, setShowSiliconflowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setSiliconflowKey(localStorage.getItem(STORAGE_KEYS.siliconflowApiKey) || '')
    setApiBaseUrl(localStorage.getItem(STORAGE_KEYS.apiBaseUrl) || '')
  }, [])

  function handleSave() {
    if (typeof window === 'undefined') return
    if (siliconflowKey.trim()) {
      localStorage.setItem(STORAGE_KEYS.siliconflowApiKey, siliconflowKey.trim())
    } else {
      localStorage.removeItem(STORAGE_KEYS.siliconflowApiKey)
    }
    if (apiBaseUrl.trim()) {
      localStorage.setItem(STORAGE_KEYS.apiBaseUrl, apiBaseUrl.trim())
    } else {
      localStorage.removeItem(STORAGE_KEYS.apiBaseUrl)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="container mx-auto min-w-0 w-full max-w-2xl px-3 py-4 sm:px-4 md:px-6 md:py-8">
      <div className="mb-6 flex items-center gap-2">
        <Settings className="h-6 w-6 shrink-0 text-muted-foreground sm:h-6 sm:w-6" />
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">设置</h1>
      </div>

      <div className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-muted/50 p-0.5 [-webkit-overflow-scrolling:touch]">
        <button
          type="button"
          onClick={() => setTab('api')}
          className={cn(
            'inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-10',
            tab === 'api' ? 'bg-background shadow' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Globe className="mr-2 h-4 w-4" />
          API 配置
        </button>
        <button
          type="button"
          onClick={() => setTab('ai')}
          className={cn(
            'inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-10',
            tab === 'ai' ? 'bg-background shadow' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Key className="mr-2 h-4 w-4" />
          AI 功能
        </button>
      </div>

      {tab === 'api' && (
        <Card>
          <CardHeader>
            <CardTitle>API 配置</CardTitle>
            <CardDescription>
              配置 API 基础地址，用于自定义后端服务地址。留空则使用当前站点相对路径。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api_base_url">API 基础地址 (Base URL)</Label>
              <Input
                id="api_base_url"
                type="url"
                placeholder="https://your-api.com"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'ai' && (
        <Card>
          <CardHeader>
            <CardTitle>AI 功能</CardTitle>
            <CardDescription>
              配置硅基流动 API Key，使用 Qwen3-VL-32B 完成订单/客户解析（含图片）与发货日推荐。Key
              仅保存在本机浏览器，请求时由前端传给本站 API，不会写入业务数据库。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siliconflow_api_key">硅基流动 API Key</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="siliconflow_api_key"
                  type={showSiliconflowKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={siliconflowKey}
                  onChange={(e) => setSiliconflowKey(e.target.value)}
                  className="min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 sm:h-10 sm:w-10"
                  onClick={() => setShowSiliconflowKey(!showSiliconflowKey)}
                >
                  {showSiliconflowKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                默认模型 Qwen/Qwen3-VL-32B-Instruct；可在服务端环境变量 SILICONFLOW_VL_MODEL 覆盖。控制台：https://cloud.siliconflow.cn/
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        <Button onClick={handleSave} className="w-full sm:w-auto">
          {saved ? '已保存' : '保存配置'}
        </Button>
      </div>
    </div>
  )
}
