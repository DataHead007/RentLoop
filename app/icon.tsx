import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

/** PWA / 浏览器图标：简洁「R」+ 品牌色，留边适配 maskable 裁剪 */
export default function Icon() {
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
          fontSize: 280,
          fontWeight: 700,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          letterSpacing: '-0.05em',
        }}
      >
        R
      </div>
    ),
    { ...size }
  )
}
