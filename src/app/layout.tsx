import type { Metadata, Viewport } from 'next'
import { Inter, Padauk } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { QueryProvider } from '@/components/providers/query-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })

/** Padauk is the reference Myanmar Unicode face and ships every needed glyph. */
const padauk = Padauk({
  subsets: ['myanmar'],
  weight: ['400', '700'],
  variable: '--font-myanmar',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Myanmar ERP — Business Management',
  description: 'Multi-tenant ERP, POS and accounting built for businesses in Myanmar.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Myanmar ERP' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom stays enabled — pinch-to-zoom is an accessibility requirement, and
  // shop owners routinely zoom into receipt figures.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
  ],
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="my" suppressHydrationWarning className={`${inter.variable} ${padauk.variable}`}>
      <body className="min-h-[100dvh] font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            {children}
            <Toaster position="top-center" richColors closeButton />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
