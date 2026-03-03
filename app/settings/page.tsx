'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Key, Globe, Eye, EyeOff } from 'lucide-react'
import { STORAGE_KEYS } from '@/lib/settings/storageKeys'

export default function SettingsPage() {
  const [tab, setTab] = useState<'api' | 'ai'>('ai')
  const [geminiKey, setGeminiKey] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setGeminiKey(localStorage.getItem(STORAGE_KEYS.geminiApiKey) || '')
    setApiBaseUrl(localStorage.getItem(STORAGE_KEYS.apiBaseUrl) || '')
  }, [])

  function handleSave() {
    if (typeof window === 'undefined') return
    if (geminiKey.trim()) {
      localStorage.setItem(STORAGE_KEYS.geminiApiKey, geminiKey.trim())
    } else {
      localStorage.removeItem(STORAGE_KEYS.geminiApiKey)
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
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">设置</h1>
      </div>

      <div className="flex gap-2 border-b pb-2 mb-4">
        <Button
          variant={tab === 'api' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setTab('api')}
        >
          <Globe className="h-4 w-4 mr-2" />
          API 配置
        </Button>
        <Button
          variant={tab === 'ai' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setTab('ai')}
        >
          <Key className="h-4 w-4 mr-2" />
          AI 功能
        </Button>
      </div>

      {tab === 'api' && (
        <Card>
          <CardHeader>
            <CardTitle>API 配置</CardTitle>
            <CardDescription>
              配置 API 基础地址，用于自定义后端服务地址。留空则使用当前站点相对路径。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              配置 Gemini API Key 以使用快捷录入、客户解析等 AI 功能。Key 仅存储在当前浏览器本地，不会上传到服务器。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gemini_api_key">Gemini API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="gemini_api_key"
                  type={showGeminiKey ? 'text' : 'password'}
                  placeholder="输入你的 Gemini API Key"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                >
                  {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                可从 Google AI Studio 获取：https://aistudio.google.com/apikey
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        <Button onClick={handleSave}>{saved ? '已保存' : '保存配置'}</Button>
      </div>
    </div>
  )
}
