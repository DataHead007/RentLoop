'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>出错了</CardTitle>
          <CardDescription>
            {error.message || '页面加载时发生错误，请重试。'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset}>重试</Button>
        </CardContent>
      </Card>
    </div>
  )
}
