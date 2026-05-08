import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** iOS「添加到主屏幕」用 Apple Touch Icon */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #2563eb 0%, #1d4ed8 55%, #1e40af 100%)',
          color: '#ffffff',
          fontSize: 96,
          fontWeight: 700,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        R
      </div>
    ),
    { ...size }
  )
}
