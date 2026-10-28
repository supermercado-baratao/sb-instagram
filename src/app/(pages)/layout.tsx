import '../styles/globals.css'

import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { Toaster } from '@/app/components/ui/shadcn/sonner'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: { template: '%s · SB Instagram', default: 'SB Instagram' },
  description:
    'Ferramenta open source para supermercados criarem as artes de ofertas do Instagram.'
}

const RootLayout = ({ children }: LayoutProps<'/'>) => (
  <html
    lang="pt-BR"
    className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
  >
    <body className="flex min-h-full flex-col">
      {children}
      <Toaster />
    </body>
  </html>
)

export default RootLayout
