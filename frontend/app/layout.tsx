import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: { default: 'TotalOps — Window Tinting CRM', template: '%s · TotalOps' },
  description: 'TotalOps — the complete operating system for automotive, residential and commercial window tinting teams.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#5b5bf7' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet" />
        <script
          // Apply the saved theme before paint to avoid a flash.
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('totalops.theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
