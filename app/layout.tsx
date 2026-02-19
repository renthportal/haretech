import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'WindLift — Rüzgar Türbini Montaj Yönetimi',
  description: 'Rüzgar türbini montaj firmalarına özel proje yönetimi, ekip/kaynak takibi, montaj planlama ve saha ilerleme takibi platformu.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0A1F12',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" className="dark">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1A2A1F',
              color: '#E8F5E9',
              border: '1px solid rgba(0, 104, 56, 0.3)',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: {
              iconTheme: {
                primary: '#22C55E',
                secondary: '#1A2A1F',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#1A2A1F',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
