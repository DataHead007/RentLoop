'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="zh-CN">
      <body>
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>应用出错</h1>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            {error.message || '发生严重错误，请刷新页面重试。'}
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              cursor: 'pointer',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  )
}
