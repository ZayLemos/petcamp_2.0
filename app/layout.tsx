import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Baloo_2, Nunito } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const baloo = Baloo_2({ subsets: ['latin'], variable: '--font-baloo', weight: ['500', '600', '700', '800'] })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', weight: ['400', '500', '600', '700', '800'] })

export const metadata: Metadata = {
  title: 'PetCamp — Promoções',
  description: 'Gestão de promoções e verificações da equipe PetCamp',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PetCamp',
  },
  icons: {
    icon: '/petcamp-logo.png',
    apple: '/petcamp-logo.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#3D1C87',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`bg-background ${baloo.variable} ${nunito.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster position="top-center" richColors />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
